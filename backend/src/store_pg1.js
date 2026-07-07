import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const { Pool, Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedFile = path.join(__dirname, "..", "data", "store.json");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const pool = new Pool(dbConfig);
let initialized = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultMeta() {
  return {
    appName: "StoreBuddy",
    currency: "LKR",
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

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}



async function createSchemaTables(client) {
  await createMetaTable(client);
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      username VARCHAR(60) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'cashier', 'stock_handler')),
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      description TEXT
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id VARCHAR(40) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      contact_person VARCHAR(120),
      phone VARCHAR(40),
      email VARCHAR(160),
      address TEXT
    )
  `);
  await client.query(`
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
    )
  `);
  await client.query(`
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
  await client.query(`
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
  await client.query(`
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
  await client.query(`
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
}

async function createMetaTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      meta_key VARCHAR(80) PRIMARY KEY,
      meta_value TEXT NULL
    )
  `);
}

async function tableHasRows(client, tableName) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS total FROM ${quoteIdentifier(tableName)}`);
  return Number(rows[0].total) > 0;
}

async function seedMeta(client, meta) {
  const entries = Object.entries({
    appName: meta.appName,
    currency: meta.currency,
    lastBackupAt: meta.lastBackupAt,
    lastRestoredAt: meta.lastRestoredAt
  });

  for (const [key, value] of entries) {
    await client.query(
      `
        INSERT INTO app_meta (meta_key, meta_value)
        VALUES ($1, $2)
        ON CONFLICT (meta_key) DO UPDATE SET meta_value = EXCLUDED.meta_value
      `,
      [key, value]
    );
  }
}

async function replaceStore(client, store) {
  const normalized = normalizeStore(store);

  await client.query("BEGIN");

  try {
    await createMetaTable(client);
    await client.query(
      "TRUNCATE TABLE app_meta, users, categories, suppliers, products, purchase_orders, purchase_order_items, sales, sale_items RESTART IDENTITY CASCADE"
    );

    for (const user of normalized.users) {
      await client.query(
        `
          INSERT INTO users (id, name, username, password_hash, role, active)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [user.id, user.name, user.username, user.passwordHash, user.role, Boolean(user.active)]
      );
    }

    for (const category of normalized.categories) {
      await client.query(
        `
          INSERT INTO categories (id, name, description)
          VALUES ($1, $2, $3)
        `,
        [category.id, category.name, category.description || null]
      );
    }

    for (const supplier of normalized.suppliers) {
      await client.query(
        `
          INSERT INTO suppliers (id, name, contact_person, phone, email, address)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          supplier.id,
          supplier.name,
          supplier.contactPerson || null,
          supplier.phone || null,
          supplier.email || null,
          supplier.address || null
        ]
      );
    }

    for (const product of normalized.products) {
      await client.query(
        `
          INSERT INTO products
            (id, category_id, name, sku, barcode, price, cost_price, stock, reorder_level, unit, description)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          product.id,
          product.categoryId || null,
          product.name,
          product.sku || null,
          product.barcode || null,
          Number(product.price || 0),
          Number(product.costPrice || 0),
          Number(product.stock || 0),
          Number(product.reorderLevel || 0),
          product.unit || "pcs",
          product.description || null
        ]
      );
    }

    for (const order of normalized.purchaseOrders) {
      await client.query(
        `
          INSERT INTO purchase_orders (id, supplier_id, status, created_at, received_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          order.id,
          order.supplierId,
          order.status || "pending",
          toPgDate(order.createdAt),
          order.receivedAt ? toPgDate(order.receivedAt) : null,
          order.notes || null
        ]
      );

      for (const item of order.items || []) {
        await client.query(
          `
            INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, cost_price)
            VALUES ($1, $2, $3, $4)
          `,
          [order.id, item.productId, Number(item.quantity || 0), Number(item.costPrice || 0)]
        );
      }
    }

    for (const sale of normalized.sales) {
      await client.query(
        `
          INSERT INTO sales (id, cashier_id, created_at, subtotal, total, payment_method)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          sale.id,
          sale.cashierId,
          toPgDate(sale.createdAt),
          Number(sale.subtotal || 0),
          Number(sale.total || 0),
          sale.paymentMethod || "cash"
        ]
      );

      for (const item of sale.items || []) {
        await client.query(
          `
            INSERT INTO sale_items (sale_id, product_id, quantity, price)
            VALUES ($1, $2, $3, $4)
          `,
          [sale.id, item.productId, Number(item.quantity || 0), Number(item.price || 0)]
        );
      }
    }

    await seedMeta(client, normalized.meta);
    await client.query("COMMIT");
    return normalized;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function toPgDate(value) {
  return new Date(value).toISOString();
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

async function readMeta(client) {
  await createMetaTable(client);
  const { rows } = await client.query("SELECT meta_key, meta_value FROM app_meta");
  const meta = defaultMeta();

  for (const row of rows) {
    meta[row.meta_key] = row.meta_value;
  }

  return meta;
}

export async function ensureStore() {
  if (initialized) {
    return;
  }

  await ensureDatabase();
  const client = await pool.connect();

  try {
    await createSchemaTables(client);
    const hasUsers = await tableHasRows(client, "users");
    const hasCategories = await tableHasRows(client, "categories");
    const hasProducts = await tableHasRows(client, "products");

    if (!hasUsers && !hasCategories && !hasProducts) {
      const seedStore = await readSeedStore();
      await replaceStore(client, seedStore);
    } else {
      const meta = await readMeta(client);
      await seedMeta(client, meta);
    }

    initialized = true;
  } finally {
    client.release();
  }
}

export async function readStore() {
  await ensureStore();

  const client = await pool.connect();

  try {
    const { rows: users } = await client.query(`
      SELECT id, name, username, password_hash AS passwordHash, role, active
      FROM users
      ORDER BY name ASC
    `);

    const { rows: categories } = await client.query(`
      SELECT id, name, description
      FROM categories
      ORDER BY name ASC
    `);

    const { rows: products } = await client.query(`
      SELECT
        id,
        category_id AS categoryId,
        name,
        sku,
        barcode,
        price,
        cost_price AS costPrice,
        stock,
        reorder_level AS reorderLevel,
        unit,
        description
      FROM products
      ORDER BY name ASC
    `);

    const { rows: suppliers } = await client.query(`
      SELECT
        id,
        name,
        contact_person AS contactPerson,
        phone,
        email,
        address
      FROM suppliers
      ORDER BY name ASC
    `);

    const { rows: orderRows } = await client.query(`
      SELECT
        po.id,
        po.supplier_id AS supplierId,
        po.status,
        po.created_at AS createdAt,
        po.received_at AS receivedAt,
        po.notes,
        poi.product_id AS productId,
        poi.quantity,
        poi.cost_price AS costPrice
      FROM purchase_orders po
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      ORDER BY po.created_at DESC, poi.id ASC
    `);

    const { rows: saleRows } = await client.query(`
      SELECT
        s.id,
        s.cashier_id AS cashierId,
        s.created_at AS createdAt,
        s.subtotal,
        s.total,
        s.payment_method AS paymentMethod,
        si.product_id AS productId,
        si.quantity,
        si.price,
        p.name AS productName
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON p.id = si.product_id
      ORDER BY s.created_at DESC, si.id ASC
    `);

    const purchaseOrders = collapseOrders(orderRows);
    const sales = collapseSales(saleRows);
    const meta = await readMeta(client);

    return normalizeStore({
      meta,
      users: users.map((user) => ({ ...user, active: Boolean(user.active) })),
      categories,
      products: products.map(castProduct),
      suppliers,
      purchaseOrders,
      sales
    });
  } finally {
    client.release();
  }
}

function castProduct(product) {
  return {
    ...product,
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
        supplierId: row.supplierid,
        status: row.status,
        createdAt: toIso(row.createdat),
        receivedAt: toIso(row.receivedat),
        notes: row.notes || "",
        items: []
      });
    }

    if (row.productid) {
      map.get(row.id).items.push({
        productId: row.productid,
        quantity: Number(row.quantity || 0),
        costPrice: Number(row.costprice || 0)
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
        cashierId: row.cashierid,
        createdAt: toIso(row.createdat),
        subtotal: Number(row.subtotal || 0),
        total: Number(row.total || 0),
        paymentMethod: row.paymentmethod,
        items: []
      });
    }

    if (row.productid) {
      map.get(row.id).items.push({
        productId: row.productid,
        quantity: Number(row.quantity || 0),
        price: Number(row.price || 0),
        name: row.productname || ""
      });
    }
  }

  return [...map.values()];
}

export async function writeStore(store) {
  await ensureStore();
  const client = await pool.connect();

  try {
    return await replaceStore(client, store);
  } finally {
    client.release();
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
