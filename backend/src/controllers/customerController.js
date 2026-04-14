const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middleware/errorHandler');

exports.getCustomerByPhone = async (req, res, next) => {
  try {
    const { phone } = req.params;
    const result = await db.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as total_orders,
        (SELECT SUM(total_amount) FROM orders WHERE customer_id = c.id AND payment_status IN ('verified', 'cod_pending')) as total_spent
       FROM customers c WHERE c.phone_number = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      throw new AppError('Customer not found.', 404);
    }

    // Get recent orders
    const orders = await db.query(
      `SELECT id, order_items, total_amount, order_status, payment_method, order_placed_at
       FROM orders WHERE customer_id = $1 ORDER BY order_placed_at DESC LIMIT 10`,
      [result.rows[0].id]
    );

    res.json({ ...result.rows[0], recent_orders: orders.rows });
  } catch (err) {
    next(err);
  }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const { restaurant_id, phone_number, customer_name, address } = req.body;

    // Check existing
    const existing = await db.query(
      'SELECT id FROM customers WHERE phone_number = $1 AND restaurant_id = $2',
      [phone_number, restaurant_id]
    );

    if (existing.rows.length > 0) {
      // Update existing
      const result = await db.query(
        `UPDATE customers SET customer_name = $1, address = $2
         WHERE id = $3 RETURNING *`,
        [customer_name, address || '', existing.rows[0].id]
      );
      return res.json(result.rows[0]);
    }

    const result = await db.query(
      `INSERT INTO customers (restaurant_id, phone_number, customer_name, address)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [restaurant_id, phone_number, customer_name, address || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getRestaurantCustomers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, search } = req.query;

    let query = `
      SELECT c.*,
        (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as total_orders,
        (SELECT SUM(total_amount) FROM orders WHERE customer_id = c.id AND payment_status IN ('verified', 'cod_pending')) as total_spent
      FROM customers c
      WHERE c.restaurant_id = $1
    `;
    const params = [id];
    let idx = 2;

    if (search) {
      query += ` AND (c.customer_name ILIKE $${idx} OR c.phone_number ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY c.last_order_date DESC NULLS LAST';

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    query += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit, 10), offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};
