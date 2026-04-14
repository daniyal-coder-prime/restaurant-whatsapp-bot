const router = require('express').Router();
const db = require('../db');

// POST /api/orders
router.post('/', async (req, res) => {
  const {
    restaurant_id, customer_phone, customer_name,
    delivery_address, order_items, total_amount,
    payment_method, notes,
  } = req.body;

  if (!restaurant_id || !customer_phone || !order_items) {
    return res.status(400).json({ error: 'restaurant_id, customer_phone, and order_items are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO orders
       (restaurant_id, customer_phone, customer_name, delivery_address,
        order_items, total_amount, payment_method, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        restaurant_id, customer_phone, customer_name, delivery_address,
        JSON.stringify(order_items), total_amount, payment_method, notes,
      ]
    );
    res.json({ order_id: rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/orders/:id/payment-status
router.post('/:id/payment-status', async (req, res) => {
  const { status } = req.body; // 'paid' | 'rejected'
  if (!['paid', 'rejected'].includes(status)) {
    return res.status(400).json({ error: "status must be 'paid' or 'rejected'" });
  }
  try {
    await db.query(
      `UPDATE orders SET payment_status = $1, order_status = $2 WHERE id = $3`,
      [status, status === 'paid' ? 'confirmed' : 'placed', req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/orders/:id  — N8N uses this to get order details for admin notification
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
