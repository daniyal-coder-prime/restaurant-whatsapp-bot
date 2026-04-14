const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middleware/errorHandler');

exports.getMenu = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, available_only } = req.query;

    // Fetch menu items
    let query = 'SELECT * FROM menu_items WHERE restaurant_id = $1';
    const params = [id];
    let idx = 2;

    if (category) {
      query += ` AND category = $${idx++}`;
      params.push(category);
    }
    if (available_only === 'true') {
      query += ' AND is_available = 1';
    }

    query += ' ORDER BY sort_order, category, item_name';

    const result = await db.query(query, params);

    // Fetch customizations for all items and attach
    const items = result.rows;
    if (items.length > 0) {
      const itemIds = items.map(i => i.id);
      const placeholders = itemIds.map((_, i) => `$${i + 1}`).join(',');
      const custResult = await db.query(
        `SELECT * FROM customizations WHERE menu_item_id IN (${placeholders})`,
        itemIds
      );

      const custMap = {};
      for (const c of custResult.rows) {
        if (!custMap[c.menu_item_id]) custMap[c.menu_item_id] = [];
        custMap[c.menu_item_id].push({
          id: c.id,
          name: c.customization_name,
          type: c.customization_type,
          price: c.additional_price,
          is_optional: c.is_optional,
        });
      }

      for (const item of items) {
        item.customizations = custMap[item.id] || [];
      }
    }

    res.json(items);
  } catch (err) {
    next(err);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT DISTINCT category FROM menu_items WHERE restaurant_id = $1 ORDER BY category',
      [id]
    );
    res.json(result.rows.map((r) => r.category));
  } catch (err) {
    next(err);
  }
};

exports.createMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { item_name, description, base_price, image_url, category, is_available, sort_order } = req.body;

    const itemId2 = uuidv4();
    await db.query(
      `INSERT INTO menu_items (id, restaurant_id, item_name, description, base_price, image_url, category, is_available, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [itemId2, id, item_name, description || '', base_price, image_url || '', category, is_available !== false ? 1 : 0, sort_order || 0]
    );
    const result = await db.query('SELECT * FROM menu_items WHERE id = $1', [itemId2]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.updateMenuItem = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;
    const { item_name, description, base_price, image_url, category, is_available, sort_order } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (item_name !== undefined) { fields.push(`item_name = $${idx++}`); values.push(item_name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (base_price !== undefined) { fields.push(`base_price = $${idx++}`); values.push(base_price); }
    if (image_url !== undefined) { fields.push(`image_url = $${idx++}`); values.push(image_url); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); values.push(category); }
    if (is_available !== undefined) { fields.push(`is_available = $${idx++}`); values.push(is_available); }
    if (sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(sort_order); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(itemId, id);
    const result = await db.query(
      `UPDATE menu_items SET ${fields.join(', ')} WHERE id = $${idx++} AND restaurant_id = $${idx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError('Menu item not found.', 404);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.deleteMenuItem = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;
    const result = await db.query(
      'DELETE FROM menu_items WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [itemId, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Menu item not found.', 404);
    }

    res.json({ message: 'Menu item deleted.' });
  } catch (err) {
    next(err);
  }
};

exports.addCustomization = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { customization_name, customization_type, additional_price, is_optional } = req.body;

    // Verify item exists
    const item = await db.query('SELECT id FROM menu_items WHERE id = $1', [itemId]);
    if (item.rows.length === 0) {
      throw new AppError('Menu item not found.', 404);
    }

    const custId = uuidv4();
    await db.query(
      `INSERT INTO customizations (id, menu_item_id, customization_name, customization_type, additional_price, is_optional)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [custId, itemId, customization_name, customization_type, additional_price || 0, is_optional !== false ? 1 : 0]
    );
    const result = await db.query('SELECT * FROM customizations WHERE id = $1', [custId]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.deleteCustomization = async (req, res, next) => {
  try {
    const { customizationId } = req.params;
    const result = await db.query(
      'DELETE FROM customizations WHERE id = $1 RETURNING id',
      [customizationId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Customization not found.', 404);
    }

    res.json({ message: 'Customization deleted.' });
  } catch (err) {
    next(err);
  }
};
