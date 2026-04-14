const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

exports.getRestaurant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, name, owner_name, phone, whatsapp_number, bank_account_details,
              subscription_plan, monthly_fee, subscription_start_date, subscription_end_date,
              is_active, created_at
       FROM restaurants WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Restaurant not found.', 404);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateRestaurant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, owner_name, phone, bank_account_details } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (name) { fields.push(`name = $${idx++}`); values.push(name); }
    if (owner_name) { fields.push(`owner_name = $${idx++}`); values.push(owner_name); }
    if (phone) { fields.push(`phone = $${idx++}`); values.push(phone); }
    if (bank_account_details) {
      fields.push(`bank_account_details = $${idx++}`);
      values.push(JSON.stringify(bank_account_details));
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE restaurants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError('Restaurant not found.', 404);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT r.id, r.name, r.owner_name, r.phone, r.whatsapp_number,
              r.bank_account_details, r.subscription_plan, r.monthly_fee,
              r.subscription_start_date, r.subscription_end_date, r.is_active,
              (SELECT COUNT(*) FROM admin_users WHERE restaurant_id = r.id AND is_active = 1) as admin_count,
              (SELECT COUNT(*) FROM menu_items WHERE restaurant_id = r.id) as menu_item_count
       FROM restaurants r WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Restaurant not found.', 404);
    }

    // Get admin users
    const admins = await db.query(
      'SELECT id, username, phone_number, role, is_active, last_login FROM admin_users WHERE restaurant_id = $1',
      [id]
    );

    res.json({
      ...result.rows[0],
      admin_users: admins.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateBankDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bank_name, account_holder, account_number, iban } = req.body;

    const bankDetails = { bank_name, account_holder, account_number, iban };
    const result = await db.query(
      'UPDATE restaurants SET bank_account_details = $1 WHERE id = $2 RETURNING id, bank_account_details',
      [JSON.stringify(bankDetails), id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Restaurant not found.', 404);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
