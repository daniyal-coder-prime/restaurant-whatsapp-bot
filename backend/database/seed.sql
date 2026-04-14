-- =============================================
-- Seed Data for Development & Testing
-- =============================================

-- 1. Insert a test restaurant
INSERT INTO restaurants (id, name, owner_name, phone, whatsapp_number, bank_account_details, subscription_plan, monthly_fee, subscription_start_date, subscription_end_date)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Karachi Biryani House',
  'Ahmed Khan',
  '+923001234567',
  '+923001234567',
  '{"bank_name": "HBL", "account_holder": "Ahmed Khan", "account_number": "PK36HABB0000111222333444", "iban": "PK36HABB0000111222333444"}',
  'basic',
  50.00,
  '2026-04-01',
  '2027-04-01'
);

-- 2. Insert admin user (password: admin123)
INSERT INTO admin_users (id, restaurant_id, username, password_hash, phone_number, role)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'ahmed_admin',
  '$2b$10$YourHashWillBeHere',
  '+923001234567',
  'owner'
);

-- 3. Insert menu items
INSERT INTO menu_items (restaurant_id, item_name, description, base_price, category, is_available, sort_order) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Chicken Biryani', 'Aromatic basmati rice with tender chicken pieces', 350.00, 'Biryani', true, 1),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Mutton Biryani', 'Premium mutton with fragrant spices and rice', 550.00, 'Biryani', true, 2),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Chicken Karahi', 'Fresh chicken cooked in traditional karahi style', 800.00, 'Karahi', true, 3),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Mutton Karahi', 'Tender mutton pieces in rich tomato gravy', 1200.00, 'Karahi', true, 4),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Naan', 'Freshly baked tandoori naan bread', 30.00, 'Bread', true, 5),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Garlic Naan', 'Naan with garlic butter topping', 50.00, 'Bread', true, 6),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Raita', 'Yogurt with cucumber and mint', 80.00, 'Sides', true, 7),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Seekh Kebab', '4 pieces of juicy minced meat kebabs', 300.00, 'BBQ', true, 8),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Chicken Tikka', 'Marinated chicken chunks grilled to perfection', 400.00, 'BBQ', true, 9),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Cold Drink (1.5L)', 'Pepsi / Coca-Cola / 7Up', 120.00, 'Beverages', true, 10);

-- 4. Insert customizations for Biryani
INSERT INTO customizations (menu_item_id, customization_name, customization_type, additional_price, is_optional)
SELECT id, 'Half Plate', 'size', -100.00, true FROM menu_items WHERE item_name = 'Chicken Biryani'
UNION ALL
SELECT id, 'Full Plate', 'size', 0.00, true FROM menu_items WHERE item_name = 'Chicken Biryani'
UNION ALL
SELECT id, 'Family Pack', 'size', 200.00, true FROM menu_items WHERE item_name = 'Chicken Biryani'
UNION ALL
SELECT id, 'Extra Raita', 'extra', 50.00, true FROM menu_items WHERE item_name = 'Chicken Biryani'
UNION ALL
SELECT id, 'Extra Spicy', 'spice', 0.00, true FROM menu_items WHERE item_name = 'Chicken Biryani';

-- 5. Insert a test customer
INSERT INTO customers (id, restaurant_id, phone_number, customer_name, address)
VALUES (
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '+923009876543',
  'Ali Raza',
  'House 45, Block 5, Gulshan-e-Iqbal, Karachi'
);

-- 6. Insert a sample order
INSERT INTO orders (restaurant_id, customer_id, order_items, total_amount, payment_method, payment_status, order_status, delivery_address)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  '[{"item_name": "Chicken Biryani", "quantity": 2, "customizations": ["Full Plate"], "price": 700}, {"item_name": "Naan", "quantity": 4, "customizations": [], "price": 120}]',
  820.00,
  'cod',
  'cod_pending',
  'placed',
  'House 45, Block 5, Gulshan-e-Iqbal, Karachi'
);
