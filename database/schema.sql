SELECT 'CREATE DATABASE storebuddy' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'storebuddy')\gexec

CREATE TABLE IF NOT EXISTS app_meta (
  meta_key VARCHAR(80) PRIMARY KEY,
  meta_value TEXT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'cashier', 'stock_handler')),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  contact_person VARCHAR(120),
  phone VARCHAR(40),
  email VARCHAR(160),
  address TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(40) PRIMARY KEY,
  category_id VARCHAR(40),
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(80),
  barcode VARCHAR(120),
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  description TEXT,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id VARCHAR(40) PRIMARY KEY,
  supplier_id VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
  created_at TIMESTAMP NOT NULL,
  received_at TIMESTAMP NULL,
  notes TEXT,
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_order_id VARCHAR(40) NOT NULL,
  product_id VARCHAR(40) NOT NULL,
  quantity INTEGER NOT NULL,
  cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_purchase_order_items_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_purchase_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(40) PRIMARY KEY,
  cashier_id VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'cash',
  CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id BIGSERIAL PRIMARY KEY,
  sale_id VARCHAR(40) NOT NULL,
  product_id VARCHAR(40) NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);
