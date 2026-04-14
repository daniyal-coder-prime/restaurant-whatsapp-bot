const router = require('express').Router();
const db = require('../db');

// GET /api/menu/:restaurant_id
router.get('/:restaurant_id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT item_name, description, price, category
       FROM menu_items
       WHERE restaurant_id = $1 AND is_available = 1
       ORDER BY sort_order`,
      [req.params.restaurant_id]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
