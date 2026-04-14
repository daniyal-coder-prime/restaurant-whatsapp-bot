const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middleware/errorHandler');

exports.createOrder = async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const {
      restaurant_id, customer_phone, customer_name,
      delivery_address, order_items, total_amount,
      payment_method, notes,
    } = req.body;

    // Verify restaurant exists and is active
    const restaurant = await client.query(
      'SELECT id, name FROM restaurants WHERE id = $1 AND is_active = 1',
      [restaurant_id]
    );
    if (restaurant.rows.length === 0) {
      throw new AppError('Restaurant not found or inactive.', 404);
    }

    // Find or create customer
    let customerResult = await client.query(
      'SELECT id FROM customers WHERE phone_number = $1 AND restaurant_id = $2',
      [customer_phone, restaurant_id]
    );

    let customerId;
    if (customerResult.rows.length > 0) {
      customerId = customerResult.rows[0].id;
      await client.query(
        'UPDATE customers SET customer_name = $1, address = $2, last_order_date = $3 WHERE id = $4',
        [customer_name, delivery_address, new Date().toISOString(), customerId]
      );
    } else {
      customerId = uuidv4();
      await client.query(
        `INSERT INTO customers (id, restaurant_id, phone_number, customer_name, address, last_order_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [customerId, restaurant_id, customer_phone, customer_name, delivery_address, new Date().toISOString()]
      );
    }

    // Create order
    const paymentStatus = payment_method === 'cod' ? 'cod_pending' : 'pending';
    const orderId = uuidv4();
    await client.query(
      `INSERT INTO orders (id, restaurant_id, customer_id, order_items, total_amount,
        payment_method, payment_status, order_status, delivery_address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'placed', $8, $9)`,
      [orderId, restaurant_id, customerId, JSON.stringify(order_items), total_amount,
       payment_method, paymentStatus, delivery_address, notes || '']
    );
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);

    await client.query('COMMIT');

    const order = orderResult.rows[0];

    // Emit real-time event (handled by WebSocket service in app.js)
    if (req.app.get('io')) {
      req.app.get('io').to(`restaurant_${restaurant_id}`).emit('new_order', order);
    }

    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, payment_status, page = 1, limit = 20, date } = req.query;

    let query = `
      SELECT o.*,
        c.customer_name, c.phone_number as customer_phone, c.address as customer_address
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.restaurant_id = $1
    `;
    const params = [id];
    let idx = 2;

    if (status) {
      query += ` AND o.order_status = $${idx++}`;
      params.push(status);
    }
    if (payment_status) {
      query += ` AND o.payment_status = $${idx++}`;
      params.push(payment_status);
    }
    if (date) {
      query += ` AND DATE(o.order_placed_at) = $${idx++}`;
      params.push(date);
    }

    query += ' ORDER BY o.order_placed_at DESC';

    // Pagination
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    query += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit, 10), offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM orders WHERE restaurant_id = $1';
    const countParams = [id];
    let countIdx = 2;
    if (status) {
      countQuery += ` AND order_status = $${countIdx++}`;
      countParams.push(status);
    }
    if (payment_status) {
      countQuery += ` AND payment_status = $${countIdx++}`;
      countParams.push(payment_status);
    }
    if (date) {
      countQuery += ` AND DATE(order_placed_at) = $${countIdx++}`;
      countParams.push(date);
    }
    const countResult = await db.query(countQuery, countParams);

    res.json({
      orders: result.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: parseInt(countResult.rows[0].count, 10),
        pages: Math.ceil(countResult.rows[0].count / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const result = await db.query(
      `SELECT o.*,
        c.customer_name, c.phone_number as customer_phone, c.address as customer_address,
        r.name as restaurant_name, r.whatsapp_number as restaurant_whatsapp
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Order not found.', 404);
    }

    // Get payment verifications
    const verifications = await db.query(
      'SELECT * FROM payment_verifications WHERE order_id = $1 ORDER BY created_at DESC',
      [orderId]
    );

    res.json({
      ...result.rows[0],
      payment_verifications: verifications.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status, rejection_reason, estimated_delivery_time } = req.body;

    const fields = ['order_status = $1'];
    const values = [status];
    let idx = 2;

    if (rejection_reason) {
      fields.push(`rejection_reason = $${idx++}`);
      values.push(rejection_reason);
    }
    if (estimated_delivery_time) {
      fields.push(`estimated_delivery_time = $${idx++}`);
      values.push(estimated_delivery_time);
    }

    values.push(orderId);
    const result = await db.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError('Order not found.', 404);
    }

    const order = result.rows[0];

    // Emit real-time event
    if (req.app.get('io')) {
      req.app.get('io').to(`restaurant_${order.restaurant_id}`).emit('order_updated', order);
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.getPendingPayments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT o.*, c.customer_name, c.phone_number as customer_phone
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.restaurant_id = $1
         AND o.payment_method = 'bank_transfer'
         AND o.payment_status = 'pending'
       ORDER BY o.order_placed_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};
