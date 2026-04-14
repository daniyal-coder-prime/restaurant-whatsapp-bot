-- SQLite schema — 3 tables only

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT,
  whatsapp_number TEXT UNIQUE NOT NULL,
  whatsapp_number_id TEXT,
  admin_whatsapp TEXT NOT NULL,
  bank_name TEXT,
  bank_account TEXT,
  bank_holder TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  category TEXT,
  is_available INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT REFERENCES restaurants(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  delivery_address TEXT,
  order_items TEXT NOT NULL,
  total_amount REAL,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'placed',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu_items(restaurant_id);
