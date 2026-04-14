const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const config = require('../config');

const generateTokens = (userId, restaurantId, role) => {
  const accessToken = jwt.sign(
    { userId, restaurantId, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expire }
  );

  const refreshToken = uuidv4();
  return { accessToken, refreshToken };
};

function expiresAtISO() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function thirtyDaysFromNow() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function today() {
  return new Date().toISOString().split('T')[0];
}

exports.registerRestaurant = async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { name, owner_name, phone, whatsapp_number, username, password } = req.body;

    // Check if restaurant or username already exists
    const existing = await client.query(
      'SELECT id FROM restaurants WHERE whatsapp_number = $1',
      [whatsapp_number]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Restaurant with this WhatsApp number already exists.' });
    }

    const existingUser = await client.query(
      'SELECT id FROM admin_users WHERE username = $1',
      [username]
    );
    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Username already taken.' });
    }

    // Create restaurant
    const restaurantId = uuidv4();
    await client.query(
      `INSERT INTO restaurants (id, name, owner_name, phone, whatsapp_number, subscription_start_date, subscription_end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [restaurantId, name, owner_name, phone, whatsapp_number, today(), thirtyDaysFromNow()]
    );
    const restaurant = { id: restaurantId, name, whatsapp_number };

    // Create admin user
    const adminId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO admin_users (id, restaurant_id, username, password_hash, phone_number, role)
       VALUES ($1, $2, $3, $4, $5, 'owner')`,
      [adminId, restaurantId, username, passwordHash, phone]
    );
    const admin = { id: adminId, username, role: 'owner' };

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(admin.id, restaurant.id, admin.role);

    // Store refresh token
    await client.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [uuidv4(), admin.id, refreshToken, expiresAtISO()]
    );

    await client.query('COMMIT');

    res.status(201).json({
      restaurant: { id: restaurant.id, name: restaurant.name, whatsapp_number: restaurant.whatsapp_number },
      user: { id: admin.id, username: admin.username, role: admin.role },
      token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const result = await db.query(
      `SELECT au.id, au.restaurant_id, au.username, au.password_hash, au.role, au.is_active,
              r.name as restaurant_name
       FROM admin_users au
       JOIN restaurants r ON r.id = au.restaurant_id
       WHERE au.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.restaurant_id, user.role);

    // Store refresh token
    await db.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [uuidv4(), user.id, refreshToken, expiresAtISO()]
    );

    // Update last login
    await db.query(
      'UPDATE admin_users SET last_login = $1 WHERE id = $2',
      [new Date().toISOString(), user.id]
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        restaurant_id: user.restaurant_id,
        restaurant_name: user.restaurant_name,
      },
      token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    const result = await db.query(
      `SELECT rt.*, au.restaurant_id, au.role, au.is_active
       FROM refresh_tokens rt
       JOIN admin_users au ON au.id = rt.user_id
       WHERE rt.token = $1 AND rt.expires_at > $2`,
      [refresh_token, new Date().toISOString()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    const tokenData = result.rows[0];
    if (!tokenData.is_active) {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    // Delete old refresh token
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refresh_token]);

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      tokenData.user_id, tokenData.restaurant_id, tokenData.role
    );

    // Store new refresh token
    await db.query(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [uuidv4(), tokenData.user_id, newRefreshToken, expiresAtISO()]
    );

    res.json({ token: accessToken, refresh_token: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refresh_token]);
    }
    // Delete all expired tokens
    await db.query('DELETE FROM refresh_tokens WHERE expires_at < $1', [new Date().toISOString()]);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};
