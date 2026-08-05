import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedFile = path.join(__dirname, "..", "data", "store.json");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to Supabase");
    client.release();
  } catch (err) {
    console.error("❌ Supabase connection failed:", err);
  }
})();

let initialized = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultMeta() {
  return {
    appName: "StoreBuddy",
    storeName: "StoreBuddy",
    storeLogo: "",
    businessAddress: "",
    phoneNumber: "",
    emailAddress: "",
    currency: "LKR",
    receiptFooter: "Thank you for shopping with us.",
    printStoreLogo: true,
    printStoreAddress: true,
    printPhoneNumber: true,
    printCashierName: true,
    printDateTime: true,
    printBarcode: true,
    paperWidth: "80mm",
    autoPrintAfterSale: false,
    lastBackupAt: null,
    lastRestoredAt: null
  };
}

function normalizeStore(store) {
  return {
    meta: {
      ...defaultMeta(),
      ...(store.meta || {})
    },
    users: store.users || [],
    categories: store.categories || [],
    products: store.products || [],
    suppliers: store.suppliers || [],
    purchaseOrders: store.purchaseOrders || [],
    sales: store.sales || []
  };
}

async function readSeedStore() {
  const raw = await fs.readFile(seedFile, "utf8");
  return normalizeStore(JSON.parse(raw));
}

function escapeIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

async function createSchemaTables(connection) {
  await createMetaTable(connection);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      username VARCHAR(60) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'cashier', 'stock_handler')),
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      contact_person VARCHAR(120),
      phone VARCHAR(40),
      email VARCHAR(160),
      address TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(40) PRIMARY KEY,
      category_id VARCHAR(40),
      supplier_id VARCHAR(40),
      name VARCHAR(160) NOT NULL,
      sku VARCHAR(80),
      barcode VARCHAR(120),
      price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER NOT NULL DEFAULT 0,
      unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id),
      CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id VARCHAR(40) PRIMARY KEY,
      supplier_id VARCHAR(40) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
      created_at TIMESTAMP NOT NULL,
      received_at TIMESTAMP NULL,
      notes TEXT,
      CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id BIGSERIAL PRIMARY KEY,
      purchase_order_id VARCHAR(40) NOT NULL,
      product_id VARCHAR(40) NOT NULL,
      quantity INTEGER NOT NULL,
      cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      CONSTRAINT fk_purchase_order_items_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
      CONSTRAINT fk_purchase_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id VARCHAR(40) PRIMARY KEY,
      cashier_id VARCHAR(40) NOT NULL,
      created_at TIMESTAMP NOT NULL,
      subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
      total NUMERIC(10, 2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(40) NOT NULL DEFAULT 'cash',
      CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_id) REFERENCES users(id)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id BIGSERIAL PRIMARY KEY,
      sale_id VARCHAR(40) NOT NULL,
      product_id VARCHAR(40) NOT NULL,
      quantity INTEGER NOT NULL,
      price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
      CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(40) PRIMARY KEY,
      user_id VARCHAR(40),
      action VARCHAR(60) NOT NULL,
      entity VARCHAR(40) NOT NULL,
      entity_id VARCHAR(40),
      description TEXT,
      created_at TIMESTAMP NOT NULL,
      CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

async function createMetaTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      meta_key VARCHAR(80) PRIMARY KEY,
      meta_value TEXT NULL
    )
  `);
}

async function tableHasRows(connection, tableName) {
  const { rows } = await connection.query(`SELECT COUNT(*) AS total FROM ${escapeIdentifier(tableName)}`);
  return Number(rows[0].total) > 0;
}

async function seedMeta(connection, meta) {
  const entries = Object.entries({
    ...defaultMeta(),
    ...meta
  });

  for (const [key, value] of entries) {
    await connection.query(
      `
        INSERT INTO app_meta (meta_key, meta_value)
        VALUES ($1, $2)
        ON CONFLICT (meta_key) DO UPDATE SET meta_value = EXCLUDED.meta_value
      `,
      [key, value]
    );
  }
}

async function replaceStore(connection, store) {
  const normalized = normalizeStore(store);

  await connection.query("BEGIN");

  try {
    await createMetaTable(connection);
    await connection.query("DELETE FROM activity_logs");
    await connection.query("DELETE FROM sale_items");
    await connection.query("DELETE FROM sales");
    await connection.query("DELETE FROM purchase_order_items");
    await connection.query("DELETE FROM purchase_orders");
    await connection.query("DELETE FROM products");
    await connection.query("DELETE FROM suppliers");
    await connection.query("DELETE FROM categories");
    await connection.query("DELETE FROM users");
    await connection.query("DELETE FROM app_meta");

    for (const user of normalized.users) {
      await connection.query(
        `
          INSERT INTO users (id, name, username, password_hash, role, active)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [user.id, user.name, user.username, user.passwordHash, user.role, Boolean(user.active ?? true)]
      );
    }

    for (const category of normalized.categories) {
      await connection.query(
        `
          INSERT INTO categories (id, name, description, active)
          VALUES ($1, $2, $3, $4)
        `,
        [category.id, category.name, category.description || null, Boolean(category.active ?? true)]
      );
    }

    for (const supplier of normalized.suppliers) {
      await connection.query(
        `
          INSERT INTO suppliers (id, name, contact_person, phone, email, address, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          supplier.id,
          supplier.name,
          supplier.contactPerson || null,
          supplier.phone || null,
          supplier.email || null,
          supplier.address || null,
          Boolean(supplier.active ?? true)
        ]
      );
    }

    for (const product of normalized.products) {
      await connection.query(
        `
          INSERT INTO products
            (id, category_id, supplier_id, name, sku, barcode, price, cost_price, stock, reorder_level, unit, description, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          product.id,
          product.categoryId || null,
          product.supplierId || null,
          product.name,
          product.sku || null,
          product.barcode || null,
          Number(product.price || 0),
          Number(product.costPrice || 0),
          Number(product.stock || 0),
          Number(product.reorderLevel || 0),
          product.unit || "pcs",
          product.description || null,
          Boolean(product.active ?? true)
        ]
      );
    }

    for (const order of normalized.purchaseOrders) {
      await connection.query(
        `
          INSERT INTO purchase_orders (id, supplier_id, status, created_at, received_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          order.id,
          order.supplierId,
          order.status || "pending",
          toDbDate(order.createdAt),
          order.receivedAt ? toDbDate(order.receivedAt) : null,
          order.notes || null
        ]
      );

      for (const item of order.items || []) {
        await connection.query(
          `
            INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, cost_price)
            VALUES ($1, $2, $3, $4)
          `,
          [order.id, item.productId, Number(item.quantity || 0), Number(item.costPrice || 0)]
        );
      }
    }

    for (const sale of normalized.sales) {
      await connection.query(
        `
          INSERT INTO sales (id, cashier_id, created_at, subtotal, total, payment_method)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          sale.id,
          sale.cashierId,
          toDbDate(sale.createdAt),
          Number(sale.subtotal || 0),
          Number(sale.total || 0),
          sale.paymentMethod || "cash"
        ]
      );

      for (const item of sale.items || []) {
        await connection.query(
          `
            INSERT INTO sale_items (sale_id, product_id, quantity, price)
            VALUES ($1, $2, $3, $4)
          `,
          [sale.id, item.productId, Number(item.quantity || 0), Number(item.price || 0)]
        );
      }
    }

    await seedMeta(connection, normalized.meta);
    await connection.query("COMMIT");
    return normalized;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  }
}

function toDbDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

async function readMeta(connection) {
  await createMetaTable(connection);
  const { rows } = await connection.query("SELECT meta_key, meta_value FROM app_meta");
  const meta = defaultMeta();

  for (const row of rows) {
    const value = row.meta_value;
    if (["printStoreLogo", "printStoreAddress", "printPhoneNumber", "printCashierName", "printDateTime", "printBarcode", "autoPrintAfterSale"].includes(row.meta_key)) {
      meta[row.meta_key] = value === "true" || value === true;
    } else {
      meta[row.meta_key] = value;
    }
  }

  return meta;
}

export async function ensureStore() {
  if (initialized) {
    return;
  }

  const connection = await pool.connect();

  try {
    await createSchemaTables(connection);
    const hasUsers = await tableHasRows(connection, "users");
    const hasCategories = await tableHasRows(connection, "categories");
    const hasProducts = await tableHasRows(connection, "products");

    if (!hasUsers && !hasCategories && !hasProducts) {
      const seedStore = await readSeedStore();
      await replaceStore(connection, seedStore);
    } else {
      const meta = await readMeta(connection);
      await seedMeta(connection, meta);
    }

    initialized = true;
  } finally {
    connection.release();
  }
}

export async function readStore() {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows: users } = await connection.query(`
      SELECT id, name, username, password_hash AS "passwordHash", role, active
      FROM users
      WHERE active = TRUE
      ORDER BY name ASC
    `);

    const { rows: categories } = await connection.query(`
      SELECT id, name, description, active
      FROM categories
      WHERE active = TRUE
      ORDER BY name ASC
    `);

    const { rows: products } = await connection.query(`
      SELECT
        id,
        category_id AS "categoryId",
        supplier_id AS "supplierId",
        name,
        sku,
        barcode,
        price,
        cost_price AS "costPrice",
        stock,
        reorder_level AS "reorderLevel",
        unit,
        description,
        active
      FROM products
      WHERE active = TRUE
      ORDER BY name ASC
    `);

    const { rows: suppliers } = await connection.query(`
      SELECT
        id,
        name,
        contact_person AS "contactPerson",
        phone,
        email,
        address,
        active
      FROM suppliers
      WHERE active = TRUE
      ORDER BY name ASC
    `);

    const { rows: orderRows } = await connection.query(`
      SELECT
        po.id,
        po.supplier_id AS "supplierId",
        po.status,
        po.created_at AS "createdAt",
        po.received_at AS "receivedAt",
        po.notes,
        poi.product_id AS "productId",
        poi.quantity,
        poi.cost_price AS "costPrice"
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      ORDER BY po.created_at DESC, poi.id ASC
    `);

    const { rows: saleRows } = await connection.query(`
      SELECT
        s.id,
        s.cashier_id AS "cashierId",
        s.created_at AS "createdAt",
        s.subtotal,
        s.total,
        s.payment_method AS "paymentMethod",
        si.product_id AS "productId",
        si.quantity,
        si.price,
        p.name AS "productName"
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON p.id = si.product_id
      ORDER BY s.created_at DESC, si.id ASC
    `);

    const purchaseOrders = collapseOrders(orderRows);
    const sales = collapseSales(saleRows);
    const meta = await readMeta(connection);

    return normalizeStore({
      meta,
      users: users.map((user) => ({ ...user, active: Boolean(user.active) })),
      categories: categories.map((category) => ({ ...category, active: Boolean(category.active) })),
      products: products.map(castProduct),
      suppliers: suppliers.map((supplier) => ({ ...supplier, active: Boolean(supplier.active) })),
      purchaseOrders,
      sales
    });
  } finally {
    connection.release();
  }
}

function castProduct(product) {
  return {
    ...product,
    active: Boolean(product.active),
    price: Number(product.price || 0),
    costPrice: Number(product.costPrice || 0),
    stock: Number(product.stock || 0),
    reorderLevel: Number(product.reorderLevel || 0)
  };
}

function collapseOrders(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        supplierId: row.supplierId,
        status: row.status,
        createdAt: toIso(row.createdAt),
        receivedAt: toIso(row.receivedAt),
        notes: row.notes || "",
        items: []
      });
    }

    if (row.productId) {
      map.get(row.id).items.push({
        productId: row.productId,
        quantity: Number(row.quantity || 0),
        costPrice: Number(row.costPrice || 0)
      });
    }
  }

  return [...map.values()];
}

function collapseSales(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        cashierId: row.cashierId,
        createdAt: toIso(row.createdAt),
        subtotal: Number(row.subtotal || 0),
        total: Number(row.total || 0),
        paymentMethod: row.paymentMethod,
        items: []
      });
    }

    if (row.productId) {
      map.get(row.id).items.push({
        productId: row.productId,
        quantity: Number(row.quantity || 0),
        price: Number(row.price || 0),
        name: row.productName || ""
      });
    }
  }

  return [...map.values()];
}

export async function writeStore(store) {
  await ensureStore();
  const connection = await pool.connect();

  try {
    return await replaceStore(connection, store);
  } finally {
    connection.release();
  }
}

export async function withStore(updater) {
  const current = await readStore();
  const next = await updater(clone(current));
  return writeStore(next);
}

export function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function closeStore() {
  await pool.end();
}

/* ===========================================================
   PRODUCT CRUD
=========================================================== */

export async function getProducts() {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(`
      SELECT
        id,
        category_id AS "categoryId",
        supplier_id AS "supplierId",
        name,
        sku,
        barcode,
        price,
        cost_price AS "costPrice",
        stock,
        reorder_level AS "reorderLevel",
        unit,
        description,
        active
      FROM products
      WHERE active = TRUE
      ORDER BY name ASC
    `);

    return rows.map(castProduct);
  } finally {
    connection.release();
  }
}

export async function createProduct(product) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query(
      `
      INSERT INTO products
      (
        id,
        category_id,
        supplier_id,
        name,
        sku,
        barcode,
        price,
        cost_price,
        stock,
        reorder_level,
        unit,
        description,
        active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        product.id,
        product.categoryId || null,
        product.supplierId || null,
        product.name,
        product.sku || null,
        product.barcode || null,
        Number(product.price || 0),
        Number(product.costPrice || 0),
        Number(product.stock || 0),
        Number(product.reorderLevel || 0),
        product.unit || "pcs",
        product.description || "",
        true
      ]
    );
  } finally {
    connection.release();
  }
}

export async function updateProduct(id, changes) {
  await ensureStore();

  const allowed = {
    name: "name",
    barcode: "barcode",
    sku: "sku",
    categoryId: "category_id",
    supplierId: "supplier_id",
    price: "price",
    costPrice: "cost_price",
    stock: "stock",
    reorderLevel: "reorder_level",
    unit: "unit",
    description: "description"
  };
  const assignments = [];
  const values = [];
  let index = 1;

  for (const [key, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) {
      assignments.push(`${column} = $${index}`);
      values.push(["price", "costPrice", "stock", "reorderLevel"].includes(key) ? Number(changes[key] || 0) : changes[key] || null);
      index += 1;
    }
  }

  if (assignments.length === 0) {
    return;
  }

  const connection = await pool.connect();

  try {
    await connection.query(`UPDATE products SET ${assignments.join(", ")} WHERE id = $${index}`, [...values, id]);
  } finally {
    connection.release();
  }
}

export async function deleteProduct(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query("UPDATE products SET active = FALSE WHERE id = $1", [id]);
  } finally {
    connection.release();
  }
}

/* ===========================================================
   SUPPLIER CRUD
=========================================================== */

export async function getSuppliers() {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(`
      SELECT
        id,
        name,
        contact_person AS "contactPerson",
        phone,
        email,
        address,
        active
      FROM suppliers
      WHERE active = TRUE
      ORDER BY name ASC
    `);

    return rows.map((supplier) => ({ ...supplier, active: Boolean(supplier.active) }));
  } finally {
    connection.release();
  }
}

export async function createSupplier(supplier) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query(
      `
      INSERT INTO suppliers (id, name, contact_person, phone, email, address, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        supplier.id,
        supplier.name,
        supplier.contactPerson || null,
        supplier.phone || null,
        supplier.email || null,
        supplier.address || null,
        Boolean(supplier.active ?? true)
      ]
    );
  } finally {
    connection.release();
  }
}

export async function updateSupplier(id, supplier) {
  await ensureStore();

  const allowed = {
    name: "name",
    contactPerson: "contact_person",
    phone: "phone",
    email: "email",
    address: "address"
  };
  const assignments = [];
  const values = [];
  let index = 1;

  for (const [key, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(supplier, key)) {
      assignments.push(`${column} = $${index}`);
      values.push(supplier[key] || null);
      index += 1;
    }
  }

  if (assignments.length === 0) {
    return;
  }

  const connection = await pool.connect();

  try {
    await connection.query(`UPDATE suppliers SET ${assignments.join(", ")} WHERE id = $${index}`, [...values, id]);
  } finally {
    connection.release();
  }
}

export async function getSupplier(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(
      `
      SELECT id, name, contact_person AS "contactPerson", phone, email, address, active
      FROM suppliers
      WHERE id = $1
      `,
      [id]
    );

    return rows[0] ? { ...rows[0], active: Boolean(rows[0].active) } : null;
  } finally {
    connection.release();
  }
}

export async function supplierInUse(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(
      "SELECT COUNT(*) AS total FROM products WHERE active = TRUE AND supplier_id = $1",
      [id]
    );
    return Number(rows[0].total) > 0;
  } finally {
    connection.release();
  }
}

export async function deleteSupplier(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query("UPDATE suppliers SET active = FALSE WHERE id = $1", [id]);
  } finally {
    connection.release();
  }
}

/* ===========================================================
   USER CRUD
=========================================================== */

export async function getUsers() {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(`
      SELECT id, name, username, role, active
      FROM users
      WHERE active = TRUE
      ORDER BY name ASC
    `);

    return rows.map((user) => ({ ...user, active: Boolean(user.active) }));
  } finally {
    connection.release();
  }
}

export async function getUserByUsername(username) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(
      `
      SELECT id, name, username, password_hash AS "passwordHash", role, active
      FROM users
      WHERE username = $1 AND active = TRUE
      LIMIT 1
      `,
      [username]
    );

    return rows[0] ? { ...rows[0], active: Boolean(rows[0].active) } : null;
  } finally {
    connection.release();
  }
}

export async function getUserById(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(
      `
      SELECT id, name, username, password_hash AS "passwordHash", role, active
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    return rows[0] ? { ...rows[0], active: Boolean(rows[0].active) } : null;
  } finally {
    connection.release();
  }
}

export async function createUser(user) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query(
      `
      INSERT INTO users (id, name, username, password_hash, role, active)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [user.id, user.name, user.username, user.passwordHash, user.role, Boolean(user.active ?? true)]
    );
  } finally {
    connection.release();
  }
}

export async function updateUser(id, user) {
  await ensureStore();

  const assignments = [];
  const values = [];
  let index = 1;

  for (const [key, column] of [
    ["name", "name"],
    ["username", "username"],
    ["role", "role"],
    ["active", "active"],
    ["passwordHash", "password_hash"]
  ]) {
    if (Object.prototype.hasOwnProperty.call(user, key)) {
      assignments.push(`${column} = $${index}`);
      values.push(key === "active" ? Boolean(user[key]) : user[key]);
      index += 1;
    }
  }

  if (assignments.length === 0) {
    return;
  }

  const connection = await pool.connect();

  try {
    await connection.query(`UPDATE users SET ${assignments.join(", ")} WHERE id = $${index}`, [...values, id]);
  } finally {
    connection.release();
  }
}

export async function deleteUser(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query("UPDATE users SET active = FALSE WHERE id = $1", [id]);
  } finally {
    connection.release();
  }
}

/* ===========================================================
   CATEGORY CRUD
=========================================================== */

export async function getCategories() {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(`
      SELECT id, name, description, active
      FROM categories
      WHERE active = TRUE
      ORDER BY name ASC
    `);

    return rows.map((category) => ({ ...category, active: Boolean(category.active) }));
  } finally {
    connection.release();
  }
}

export async function createCategory(category) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query(
      `
      INSERT INTO categories (id, name, description, active)
      VALUES ($1, $2, $3, $4)
      `,
      [category.id, category.name, category.description || null, Boolean(category.active ?? true)]
    );
  } finally {
    connection.release();
  }
}

export async function updateCategory(id, category) {
  await ensureStore();

  const assignments = [];
  const values = [];
  let index = 1;

  if (Object.prototype.hasOwnProperty.call(category, "name")) {
    assignments.push(`name = $${index}`);
    values.push(category.name);
    index += 1;
  }

  if (Object.prototype.hasOwnProperty.call(category, "description")) {
    assignments.push(`description = $${index}`);
    values.push(category.description || null);
    index += 1;
  }

  if (assignments.length === 0) {
    return;
  }

  const connection = await pool.connect();

  try {
    await connection.query(`UPDATE categories SET ${assignments.join(", ")} WHERE id = $${index}`, [...values, id]);
  } finally {
    connection.release();
  }
}

export async function getCategory(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(
      "SELECT id, name, description, active FROM categories WHERE id = $1",
      [id]
    );
    return rows[0] ? { ...rows[0], active: Boolean(rows[0].active) } : null;
  } finally {
    connection.release();
  }
}

export async function categoryInUse(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(
      "SELECT COUNT(*) AS total FROM products WHERE active = TRUE AND category_id = $1",
      [id]
    );
    return Number(rows[0].total) > 0;
  } finally {
    connection.release();
  }
}

export async function deleteCategory(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query("UPDATE categories SET active = FALSE WHERE id = $1", [id]);
  } finally {
    connection.release();
  }
}

/* ===========================================================
   ACTIVITY LOGS
=========================================================== */

export async function getActivityLogs(limit = 50) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(
      `
      SELECT
        id,
        user_id AS "userId",
        action,
        entity,
        entity_id AS "entityId",
        description,
        created_at AS "createdAt"
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    return rows.map((row) => ({
      ...row,
      createdAt: toIso(row.createdAt)
    }));
  } finally {
    connection.release();
  }
}

export async function logActivity({
  userId = null,
  action,
  entity,
  entityId = null,
  description,
  createdAt = new Date()
}) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query(
      `
      INSERT INTO activity_logs
      (
        id,
        user_id,
        action,
        entity,
        entity_id,
        description,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        generateId("log"),
        userId,
        action,
        entity,
        entityId,
        description,
        toDbDate(createdAt)
      ]
    );
  } finally {
    connection.release();
  }
}

/* ===========================================================
   PURCHASE ORDERS
=========================================================== */

export async function getPurchaseOrders() {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(`
      SELECT
        po.id,
        po.supplier_id AS "supplierId",
        po.status,
        po.created_at AS "createdAt",
        po.received_at AS "receivedAt",
        po.notes,
        poi.product_id AS "productId",
        poi.quantity,
        poi.cost_price AS "costPrice"
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      ORDER BY po.created_at DESC, poi.id ASC
    `);

    return collapseOrders(rows);
  } finally {
    connection.release();
  }
}

export async function createPurchaseOrder(purchaseOrder) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query("BEGIN");
    await connection.query(
      `
      INSERT INTO purchase_orders (id, supplier_id, status, created_at, received_at, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        purchaseOrder.id,
        purchaseOrder.supplierId,
        purchaseOrder.status,
        toDbDate(purchaseOrder.createdAt),
        purchaseOrder.receivedAt ? toDbDate(purchaseOrder.receivedAt) : null,
        purchaseOrder.notes || null
      ]
    );

    for (const item of purchaseOrder.items) {
      await connection.query(
        `
        INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, cost_price)
        VALUES ($1, $2, $3, $4)
        `,
        [purchaseOrder.id, item.productId, Number(item.quantity || 0), Number(item.costPrice || 0)]
      );
    }

    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export async function receivePurchaseOrder(id) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query("BEGIN");
    const { rows: orders } = await connection.query(
      "SELECT id, status FROM purchase_orders WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (orders.length === 0 || orders[0].status === "received") {
      await connection.query("COMMIT");
      return;
    }

    await connection.query(
      "UPDATE purchase_orders SET status = 'received', received_at = NOW() WHERE id = $1",
      [id]
    );

    const { rows: items } = await connection.query(
      `
      SELECT product_id AS "productId", quantity, cost_price AS "costPrice"
      FROM purchase_order_items
      WHERE purchase_order_id = $1
      `,
      [id]
    );

    for (const item of items) {
      await connection.query(
        `
        UPDATE products
        SET stock = stock + $1, cost_price = $2
        WHERE id = $3
        `,
        [Number(item.quantity || 0), Number(item.costPrice || 0), item.productId]
      );
    }

    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

/* ===========================================================
   SALES
=========================================================== */

export async function getSales() {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(`
      SELECT
        s.id,
        s.cashier_id AS "cashierId",
        s.created_at AS "createdAt",
        s.subtotal,
        s.total,
        s.payment_method AS "paymentMethod",
        si.product_id AS "productId",
        si.quantity,
        si.price,
        p.name AS "productName"
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON p.id = si.product_id
      ORDER BY s.created_at DESC, si.id ASC
    `);

    return collapseSales(rows);
  } finally {
    connection.release();
  }
}

export async function getTopSellingProducts(limit = 5) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    const { rows } = await connection.query(
      `
      SELECT
        p.id,
        p.name,
        p.stock,
        p.price,
        p.reorder_level AS "reorderLevel",
        SUM(si.quantity) AS "unitsSold"
      FROM products p
      JOIN sale_items si ON si.product_id = p.id
      WHERE p.active = TRUE
      GROUP BY p.id, p.name, p.stock, p.price, p.reorder_level
      ORDER BY "unitsSold" DESC
      LIMIT $1
      `,
      [limit]
    );

    return rows.map((product) => ({
      id: product.id,
      name: product.name,
      unitsSold: Number(product.unitsSold || 0),
      stock: Number(product.stock || 0),
      price: Number(product.price || 0),
      reorderLevel: Number(product.reorderLevel || 0)
    }));
  } finally {
    connection.release();
  }
}

export async function createSale({ id, cashierId, paymentMethod, items }) {
  await ensureStore();

  const connection = await pool.connect();

  try {
    await connection.query("BEGIN");
    const saleItems = [];

    for (const item of items) {
      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) {
        throw new Error("Quantity must be greater than zero.");
      }

      const { rows: products } = await connection.query(
        `
        SELECT id, name, price, stock
        FROM products
        WHERE id = $1 AND active = TRUE
        FOR UPDATE
        `,
        [item.productId]
      );
      const product = products[0];

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (Number(product.stock) < quantity) {
        throw new Error(`Not enough stock for ${product.name}.`);
      }

      saleItems.push({
        productId: product.id,
        quantity,
        price: Number(product.price),
        name: product.name
      });
    }

    const subtotal = saleItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const createdAt = new Date();

    await connection.query(
      `
      INSERT INTO sales (id, cashier_id, created_at, subtotal, total, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [id, cashierId, toDbDate(createdAt), subtotal, subtotal, paymentMethod || "cash"]
    );

    for (const item of saleItems) {
      await connection.query(
        `
        INSERT INTO sale_items (sale_id, product_id, quantity, price)
        VALUES ($1, $2, $3, $4)
        `,
        [id, item.productId, item.quantity, item.price]
      );
      await connection.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",
        [item.quantity, item.productId]
      );
    }

    await connection.query("COMMIT");

    return {
      id,
      cashierId,
      createdAt: toIso(createdAt),
      items: saleItems,
      subtotal,
      total: subtotal,
      paymentMethod: paymentMethod || "cash"
    };
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

/* ===========================================================
   BACKUP / RESTORE
=========================================================== */

export async function exportBackup() {
  await ensureStore();

  const lastBackupAt = new Date().toISOString();
  const connection = await pool.connect();

  try {
    await seedMeta(connection, {
      ...(await readMeta(connection)),
      lastBackupAt
    });
  } finally {
    connection.release();
  }

  return readStore();
}

export async function restoreBackup(backup) {
  await ensureStore();

  const next = normalizeStore({
    ...backup,
    meta: {
      ...(backup.meta || {}),
      lastRestoredAt: new Date().toISOString()
    }
  });
  const connection = await pool.connect();

  try {
    await connection.query("BEGIN");
    await connection.query("DELETE FROM activity_logs");
    await connection.query("DELETE FROM sale_items");
    await connection.query("DELETE FROM sales");
    await connection.query("DELETE FROM purchase_order_items");
    await connection.query("DELETE FROM purchase_orders");
    await connection.query("DELETE FROM products");
    await connection.query("DELETE FROM suppliers");
    await connection.query("DELETE FROM categories");
    await connection.query("DELETE FROM users");
    await connection.query("DELETE FROM app_meta");

    for (const user of next.users) {
      await connection.query(
        `
          INSERT INTO users (id, name, username, password_hash, role, active)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [user.id, user.name, user.username, user.passwordHash, user.role, Boolean(user.active ?? true)]
      );
    }

    for (const category of next.categories) {
      await connection.query(
        `
          INSERT INTO categories (id, name, description, active)
          VALUES ($1, $2, $3, $4)
        `,
        [category.id, category.name, category.description || null, Boolean(category.active ?? true)]
      );
    }

    for (const supplier of next.suppliers) {
      await connection.query(
        `
          INSERT INTO suppliers (id, name, contact_person, phone, email, address, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          supplier.id,
          supplier.name,
          supplier.contactPerson || null,
          supplier.phone || null,
          supplier.email || null,
          supplier.address || null,
          Boolean(supplier.active ?? true)
        ]
      );
    }

    for (const product of next.products) {
      await connection.query(
        `
          INSERT INTO products
            (id, category_id, supplier_id, name, sku, barcode, price, cost_price, stock, reorder_level, unit, description, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          product.id,
          product.categoryId || null,
          product.supplierId || null,
          product.name,
          product.sku || null,
          product.barcode || null,
          Number(product.price || 0),
          Number(product.costPrice || 0),
          Number(product.stock || 0),
          Number(product.reorderLevel || 0),
          product.unit || "pcs",
          product.description || null,
          Boolean(product.active ?? true)
        ]
      );
    }

    for (const order of next.purchaseOrders) {
      await connection.query(
        `
          INSERT INTO purchase_orders (id, supplier_id, status, created_at, received_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          order.id,
          order.supplierId,
          order.status || "pending",
          toDbDate(order.createdAt),
          order.receivedAt ? toDbDate(order.receivedAt) : null,
          order.notes || null
        ]
      );

      for (const item of order.items || []) {
        await connection.query(
          `
            INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, cost_price)
            VALUES ($1, $2, $3, $4)
          `,
          [order.id, item.productId, Number(item.quantity || 0), Number(item.costPrice || 0)]
        );
      }
    }

    for (const sale of next.sales) {
      await connection.query(
        `
          INSERT INTO sales (id, cashier_id, created_at, subtotal, total, payment_method)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          sale.id,
          sale.cashierId,
          toDbDate(sale.createdAt),
          Number(sale.subtotal || 0),
          Number(sale.total || 0),
          sale.paymentMethod || "cash"
        ]
      );

      for (const item of sale.items || []) {
        await connection.query(
          `
            INSERT INTO sale_items (sale_id, product_id, quantity, price)
            VALUES ($1, $2, $3, $4)
          `,
          [sale.id, item.productId, Number(item.quantity || 0), Number(item.price || 0)]
        );
      }
    }

    await seedMeta(connection, next.meta);
    await connection.query("COMMIT");
    return next;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateMeta(changes) {
  await ensureStore();
  const allowed = new Set(Object.keys(defaultMeta()));
  const currentStore = await readStore();
  const nextMeta = { ...currentStore.meta };

  for (const [key, value] of Object.entries(changes || {})) {
    if (allowed.has(key)) {
      nextMeta[key] = value;
    }
  }

  const connection = await pool.connect();

  try {
    await seedMeta(connection, nextMeta);
  } finally {
    connection.release();
  }

  return nextMeta;
}
