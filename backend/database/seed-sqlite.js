/**
 * Seeds the SQLite database with test data
 * Run: node database/seed-sqlite.js
 */
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'restaurant.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read and execute schema
const fs = require('fs');
const schema = fs.readFileSync(path.join(__dirname, 'schema-sqlite.sql'), 'utf-8');
db.exec(schema);
console.log('Schema created.');

// IDs
const RESTAURANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const CUSTOMER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

// 1. Restaurant
db.prepare(`
  INSERT OR REPLACE INTO restaurants (id, name, owner_name, phone, whatsapp_number, bank_account_details, subscription_plan, monthly_fee, subscription_start_date, subscription_end_date, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  RESTAURANT_ID,
  'Karachi Biryani House',
  'Ahmed Khan',
  '+923001234567',
  '+923001234567',
  JSON.stringify({ bank_name: 'HBL', account_holder: 'Ahmed Khan', account_number: 'PK36HABB0000111222333444', iban: 'PK36HABB0000111222333444' }),
  'basic',
  50.00,
  '2026-04-01',
  '2027-04-01',
  1
);
console.log('Restaurant seeded.');

// 2. Admin user (password: admin123)
const passwordHash = bcrypt.hashSync('admin123', 10);
db.prepare(`
  INSERT OR REPLACE INTO admin_users (id, restaurant_id, username, password_hash, phone_number, role, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(ADMIN_ID, RESTAURANT_ID, 'ahmed_admin', passwordHash, '+923001234567', 'owner', 1);
console.log('Admin user seeded (username: ahmed_admin, password: admin123)');

// 3. Menu items
const menuItems = [
  { name: 'Chicken Biryani', desc: 'Aromatic basmati rice with tender chicken pieces', price: 350, cat: 'Biryani', sort: 1 },
  { name: 'Mutton Biryani', desc: 'Premium mutton with fragrant spices and rice', price: 550, cat: 'Biryani', sort: 2 },
  { name: 'Chicken Karahi', desc: 'Fresh chicken cooked in traditional karahi style', price: 800, cat: 'Karahi', sort: 3 },
  { name: 'Mutton Karahi', desc: 'Tender mutton pieces in rich tomato gravy', price: 1200, cat: 'Karahi', sort: 4 },
  { name: 'Naan', desc: 'Freshly baked tandoori naan bread', price: 30, cat: 'Bread', sort: 5 },
  { name: 'Garlic Naan', desc: 'Naan with garlic butter topping', price: 50, cat: 'Bread', sort: 6 },
  { name: 'Raita', desc: 'Yogurt with cucumber and mint', price: 80, cat: 'Sides', sort: 7 },
  { name: 'Seekh Kebab', desc: '4 pieces of juicy minced meat kebabs', price: 300, cat: 'BBQ', sort: 8 },
  { name: 'Chicken Tikka', desc: 'Marinated chicken chunks grilled to perfection', price: 400, cat: 'BBQ', sort: 9 },
  { name: 'Cold Drink (1.5L)', desc: 'Pepsi / Coca-Cola / 7Up', price: 120, cat: 'Beverages', sort: 10 },
];

const insertMenu = db.prepare(`
  INSERT OR REPLACE INTO menu_items (id, restaurant_id, item_name, description, base_price, category, is_available, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?)
`);

const menuIds = {};
for (const item of menuItems) {
  const id = uuidv4();
  insertMenu.run(id, RESTAURANT_ID, item.name, item.desc, item.price, item.cat, item.sort);
  menuIds[item.name] = id;
}
console.log(`${menuItems.length} menu items seeded.`);

// 4. Customizations for Chicken Biryani
const biryaniId = menuIds['Chicken Biryani'];
const insertCustomization = db.prepare(`
  INSERT INTO customizations (id, menu_item_id, customization_name, customization_type, additional_price, is_optional)
  VALUES (?, ?, ?, ?, ?, 1)
`);
insertCustomization.run(uuidv4(), biryaniId, 'Half Plate', 'size', -100);
insertCustomization.run(uuidv4(), biryaniId, 'Full Plate', 'size', 0);
insertCustomization.run(uuidv4(), biryaniId, 'Family Pack', 'size', 200);
insertCustomization.run(uuidv4(), biryaniId, 'Extra Raita', 'extra', 50);
insertCustomization.run(uuidv4(), biryaniId, 'Extra Spicy', 'spice', 0);
console.log('5 customizations seeded for Chicken Biryani.');

// 5. Test customer
db.prepare(`
  INSERT OR REPLACE INTO customers (id, restaurant_id, phone_number, customer_name, address)
  VALUES (?, ?, ?, ?, ?)
`).run(CUSTOMER_ID, RESTAURANT_ID, '+923009876543', 'Ali Raza', 'House 45, Block 5, Gulshan-e-Iqbal, Karachi');
console.log('Test customer seeded.');

// 6. Sample order
db.prepare(`
  INSERT INTO orders (id, restaurant_id, customer_id, order_items, total_amount, payment_method, payment_status, order_status, delivery_address)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  uuidv4(),
  RESTAURANT_ID,
  CUSTOMER_ID,
  JSON.stringify([
    { item_name: 'Chicken Biryani', quantity: 2, customizations: ['Full Plate'], price: 700 },
    { item_name: 'Naan', quantity: 4, customizations: [], price: 120 }
  ]),
  820,
  'cod',
  'cod_pending',
  'placed',
  'House 45, Block 5, Gulshan-e-Iqbal, Karachi'
);
console.log('Sample order seeded.');

db.close();
console.log('\nDone! Database seeded at:', DB_PATH);
