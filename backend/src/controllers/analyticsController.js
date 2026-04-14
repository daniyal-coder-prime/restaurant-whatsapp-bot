const db = require('../config/database');

/**
 * Parse popular items from orders by reading JSON order_items in JavaScript.
 * Works with both PostgreSQL and SQLite.
 */
async function getPopularItemsFromOrders(restaurantId, dateCondition, params) {
  const result = await db.query(
    `SELECT order_items FROM orders WHERE restaurant_id = $1 AND ${dateCondition}`,
    params
  );

  const itemCounts = {};
  for (const row of result.rows) {
    let items = row.order_items;
    if (typeof items === 'string') items = JSON.parse(items);
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const name = item.item_name;
      if (!name) continue;
      if (!itemCounts[name]) itemCounts[name] = { item_name: name, total_quantity: 0, total_revenue: 0 };
      itemCounts[name].total_quantity += (item.quantity || 1);
      itemCounts[name].total_revenue += (item.price || 0);
    }
  }

  return Object.values(itemCounts).sort((a, b) => b.total_quantity - a.total_quantity);
}

exports.getToday = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_order_value,
        COUNT(CASE WHEN order_status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) as cancelled_orders,
        COUNT(CASE WHEN order_status IN ('placed', 'confirmed', 'preparing', 'ready') THEN 1 END) as active_orders,
        COUNT(CASE WHEN payment_method = 'bank_transfer' THEN 1 END) as bank_transfer_count,
        COUNT(CASE WHEN payment_method = 'cod' THEN 1 END) as cod_count,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments
       FROM orders
       WHERE restaurant_id = $1 AND date(order_placed_at) = date('now')`,
      [id]
    );

    const popular = await getPopularItemsFromOrders(
      id,
      "date(order_placed_at) = date('now')",
      [id]
    );

    res.json({
      ...result.rows[0],
      popular_items: popular.slice(0, 10),
    });
  } catch (err) {
    next(err);
  }
};

exports.getWeek = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        date(order_placed_at) as date,
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_order_value
       FROM orders
       WHERE restaurant_id = $1
         AND order_placed_at >= date('now', '-7 days')
       GROUP BY date(order_placed_at)
       ORDER BY date`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

exports.getMonth = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        date(order_placed_at) as date,
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_order_value
       FROM orders
       WHERE restaurant_id = $1
         AND order_placed_at >= date('now', '-30 days')
       GROUP BY date(order_placed_at)
       ORDER BY date`,
      [id]
    );

    const paymentBreakdown = await db.query(
      `SELECT payment_method, COUNT(*) as count, SUM(total_amount) as total
       FROM orders
       WHERE restaurant_id = $1
         AND order_placed_at >= date('now', '-30 days')
       GROUP BY payment_method`,
      [id]
    );

    res.json({
      daily: result.rows,
      payment_breakdown: paymentBreakdown.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.getPopularItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    const popular = await getPopularItemsFromOrders(
      id,
      `order_placed_at >= date('now', '-${parseInt(days)} days')`,
      [id]
    );

    res.json(popular.slice(0, 20));
  } catch (err) {
    next(err);
  }
};
