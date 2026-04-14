const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const result = await db.query(
      'SELECT id, restaurant_id, username, role, is_active FROM admin_users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid or inactive user.' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
};

const authorizeRestaurant = (req, res, next) => {
  const restaurantId = req.params.id || req.params.restaurantId || req.body.restaurant_id;
  if (restaurantId && req.user.restaurant_id !== restaurantId) {
    return res.status(403).json({ error: 'Access denied to this restaurant.' });
  }
  next();
};

module.exports = { authenticate, authorizeRoles, authorizeRestaurant };
