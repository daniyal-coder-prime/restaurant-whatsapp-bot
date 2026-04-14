-- PostgreSQL schema — 3 tables only
-- Run: psql -U postgres -d restaurant_bot -f schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  whatsapp_number_id VARCHAR(50),
  admin_whatsapp VARCHAR(20) NOT NULL,
  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  bank_holder VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(100),
  is_available BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  customer_phone VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  delivery_address TEXT,
  order_items JSONB NOT NULL,
  total_amount DECIMAL(10,2),
  payment_method VARCHAR(20),
  payment_status VARCHAR(20) DEFAULT 'pending',
  order_status VARCHAR(20) DEFAULT 'placed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu_items(restaurant_id);
