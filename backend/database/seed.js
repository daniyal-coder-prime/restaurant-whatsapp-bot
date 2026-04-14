/**
 * Seeds the database with one test restaurant and menu.
 * Run: USE_SQLITE=true node database/seed.js
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const USE_SQLITE = process.env.USE_SQLITE === 'true';

function seedSQLite() {
  const Database = require('better-sqlite3');
  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'restaurant_bot.db');
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema-sqlite.sql'), 'utf8');
  db.exec(schema);

  const { v4: uuidv4 } = require && (() => {
    try { return require('uuid').v4; } catch { return () => require('crypto').randomUUID(); }
  })() || (() => require('crypto').randomUUID());

  const restaurantId = uuidv4 ? uuidv4() : require('crypto').randomUUID();

  // Clear existing data
  db.exec('DELETE FROM orders; DELETE FROM menu_items; DELETE FROM restaurants;');

  db.prepare(`
    INSERT INTO restaurants (id, name, owner_name, whatsapp_number, admin_whatsapp, bank_name, bank_account, bank_holder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(restaurantId, 'Ahmed Biryani House', 'Ahmed Khan', '+92300XXXXXXX', '+92321XXXXXXX', 'HBL', '1234-5678-9012', 'Ahmed Khan');

  const menuItems = [
    ['Chicken Biryani', 'Aromatic basmati with tender chicken', 350, 'Biryani', 1],
    ['Beef Biryani', 'Slow-cooked beef with spices', 400, 'Biryani', 2],
    ['Mutton Biryani', 'Premium mutton dum biryani', 500, 'Biryani', 3],
    ['Chicken Karahi', 'Spicy wok-cooked chicken', 800, 'Karahi', 4],
    ['Beef Karahi', 'Slow-cooked beef with tomatoes', 900, 'Karahi', 5],
    ['Seekh Kabab', '4 pieces, charcoal grilled', 300, 'BBQ', 6],
    ['Chicken Tikka', '6 pieces, marinated & grilled', 350, 'BBQ', 7],
    ['Naan', 'Fresh from tandoor', 30, 'Bread', 8],
    ['Roghni Naan', 'Butter naan with sesame', 50, 'Bread', 9],
    ['Raita', 'Yogurt with mint', 50, 'Sides', 10],
  ];

  const insert = db.prepare(`
    INSERT INTO menu_items (id, restaurant_id, item_name, description, price, category, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const [name, desc, price, cat, order] of menuItems) {
    insert.run(require('crypto').randomUUID(), restaurantId, name, desc, price, cat, order);
  }

  console.log('Seeded restaurant ID:', restaurantId);
  console.log('Seeded', menuItems.length, 'menu items');
  console.log('\nCopy this RESTAURANT_ID into your .env and N8N env vars:');
  console.log(restaurantId);
  db.close();
}

async function seedPostgres() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  // Clear existing test data
  await pool.query('TRUNCATE orders, menu_items, restaurants RESTART IDENTITY CASCADE');

  const { rows: [restaurant] } = await pool.query(`
    INSERT INTO restaurants (name, owner_name, whatsapp_number, admin_whatsapp, bank_name, bank_account, bank_holder)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, ['Ahmed Biryani House', 'Ahmed Khan', '+92300XXXXXXX', '+92321XXXXXXX', 'HBL', '1234-5678-9012', 'Ahmed Khan']);

  const restaurantId = restaurant.id;

  const menuItems = [
    ['Chicken Biryani', 'Aromatic basmati with tender chicken', 350, 'Biryani', 1],
    ['Beef Biryani', 'Slow-cooked beef with spices', 400, 'Biryani', 2],
    ['Mutton Biryani', 'Premium mutton dum biryani', 500, 'Biryani', 3],
    ['Chicken Karahi', 'Spicy wok-cooked chicken', 800, 'Karahi', 4],
    ['Beef Karahi', 'Slow-cooked beef with tomatoes', 900, 'Karahi', 5],
    ['Seekh Kabab', '4 pieces, charcoal grilled', 300, 'BBQ', 6],
    ['Chicken Tikka', '6 pieces, marinated & grilled', 350, 'BBQ', 7],
    ['Naan', 'Fresh from tandoor', 30, 'Bread', 8],
    ['Roghni Naan', 'Butter naan with sesame', 50, 'Bread', 9],
    ['Raita', 'Yogurt with mint', 50, 'Sides', 10],
  ];

  for (const [name, desc, price, cat, order] of menuItems) {
    await pool.query(
      'INSERT INTO menu_items (restaurant_id, item_name, description, price, category, sort_order) VALUES ($1,$2,$3,$4,$5,$6)',
      [restaurantId, name, desc, price, cat, order]
    );
  }

  console.log('Seeded restaurant ID:', restaurantId);
  console.log('Seeded', menuItems.length, 'menu items');
  console.log('\nCopy this RESTAURANT_ID into your .env and N8N env vars:');
  console.log(restaurantId);
  await pool.end();
}

if (USE_SQLITE) {
  seedSQLite();
} else {
  seedPostgres().catch(err => { console.error(err); process.exit(1); });
}
