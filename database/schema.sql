CREATE DATABASE IF NOT EXISTS storebuddy;
USE storebuddy;

CREATE TABLE users (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'cashier', 'stock_handler') NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE categories (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT
);

CREATE TABLE suppliers (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  contact_person VARCHAR(120),
  phone VARCHAR(40),
  email VARCHAR(160),
  address TEXT
);

CREATE TABLE products (
  id VARCHAR(40) PRIMARY KEY,
  category_id VARCHAR(40),
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(80),
  barcode VARCHAR(120),
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
  description TEXT,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE purchase_orders (
  id VARCHAR(40) PRIMARY KEY,
  supplier_id VARCHAR(40) NOT NULL,
  status ENUM('pending', 'received') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL,
  received_at DATETIME NULL,
  notes TEXT,
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id VARCHAR(40) NOT NULL,
  product_id VARCHAR(40) NOT NULL,
  quantity INT NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_purchase_order_items_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_purchase_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE sales (
  id VARCHAR(40) PRIMARY KEY,
  cashier_id VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'cash',
  CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users(id)
);

CREATE TABLE sale_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id VARCHAR(40) NOT NULL,
  product_id VARCHAR(40) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);
