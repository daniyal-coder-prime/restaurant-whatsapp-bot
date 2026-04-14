const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

exports.uploadScreenshot = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { screenshot_url } = req.body;

    // Verify order exists and is pending payment
    const order = await db.query(
      "SELECT id, restaurant_id, total_amount, payment_status FROM orders WHERE id = $1 AND payment_method = 'bank_transfer'",
      [orderId]
    );

    if (order.rows.length === 0) {
      throw new AppError('Order not found or not a bank transfer order.', 404);
    }

    if (order.rows[0].payment_status !== 'pending') {
      throw new AppError('Payment already processed for this order.', 400);
    }

    // Update order with screenshot
    await db.query(
      'UPDATE orders SET payment_screenshot_url = $1 WHERE id = $2',
      [screenshot_url, orderId]
    );

    // Create verification record
    const verification = await db.query(
      `INSERT INTO payment_verifications (order_id, screenshot_url, verification_type, verification_result)
       VALUES ($1, $2, 'manual', 'pending') RETURNING *`,
      [orderId, screenshot_url]
    );

    // Notify admin via WebSocket
    if (req.app.get('io')) {
      req.app.get('io')
        .to(`restaurant_${order.rows[0].restaurant_id}`)
        .emit('payment_pending', {
          order_id: orderId,
          screenshot_url,
          total_amount: order.rows[0].total_amount,
        });
    }

    res.status(201).json(verification.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { verification_result, verification_notes } = req.body;

    // Verify order exists
    const order = await db.query(
      'SELECT id, restaurant_id, payment_status FROM orders WHERE id = $1',
      [orderId]
    );

    if (order.rows.length === 0) {
      throw new AppError('Order not found.', 404);
    }

    // Update the latest payment verification record
    await db.query(
      `UPDATE payment_verifications
       SET verification_result = $1, verification_notes = $2, verified_by = $3, verification_type = 'manual'
       WHERE order_id = $4 AND verification_result = 'pending'`,
      [verification_result, verification_notes || '', req.user.id, orderId]
    );

    // Update order payment status
    const newPaymentStatus = verification_result === 'approved' ? 'verified' : 'failed';
    const orderUpdate = await db.query(
      `UPDATE orders
       SET payment_status = $1, payment_verified_at = CASE WHEN $1 = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $2 RETURNING *`,
      [newPaymentStatus, orderId]
    );

    // If approved, auto-confirm the order
    if (verification_result === 'approved') {
      await db.query(
        "UPDATE orders SET order_status = 'confirmed' WHERE id = $1 AND order_status = 'placed'",
        [orderId]
      );
    }

    const updatedOrder = orderUpdate.rows[0];

    // Emit real-time event
    if (req.app.get('io')) {
      req.app.get('io')
        .to(`restaurant_${updatedOrder.restaurant_id}`)
        .emit('payment_verified', {
          order_id: orderId,
          payment_status: newPaymentStatus,
          verification_result,
        });
    }

    res.json({
      order_id: orderId,
      payment_status: newPaymentStatus,
      verification_result,
    });
  } catch (err) {
    next(err);
  }
};

exports.getPendingVerifications = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurant_id;

    const result = await db.query(
      `SELECT pv.*, o.total_amount, o.order_items, o.order_placed_at,
              c.customer_name, c.phone_number as customer_phone
       FROM payment_verifications pv
       JOIN orders o ON o.id = pv.order_id
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.restaurant_id = $1 AND pv.verification_result = 'pending'
       ORDER BY pv.created_at ASC`,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};
