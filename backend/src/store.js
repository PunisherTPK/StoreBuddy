import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.join(__dirname, "..", "data", "store.json");

const defaultStore = {
  meta: {
    appName: "StoreBuddy",
    currency: "LKR",
    lastBackupAt: null,
    lastRestoredAt: null
  },
  users: [
    {
      id: "user-admin",
      name: "Admin User",
      username: "admin",
      role: "admin",
      passwordHash: hashPassword("admin123"),
      active: true
    },
    {
      id: "user-cashier",
      name: "Cashier One",
      username: "cashier",
      role: "cashier",
      passwordHash: hashPassword("cashier123"),
      active: true
    },
    {
      id: "user-stock",
      name: "Stock Handler",
      username: "stock",
      role: "stock_handler",
      passwordHash: hashPassword("stock123"),
      active: true
    }
  ],
  categories: [
    { id: "cat-books", name: "Books", description: "School and office books" },
    { id: "cat-stationery", name: "Stationery", description: "Daily stationery items" },
    { id: "cat-mobile", name: "Mobile Accessories", description: "Phone accessories and chargers" }
  ],
  products: [
    {
      id: "prod-notebook-a5",
      name: "A5 Notebook",
      barcode: "890100000001",
      categoryId: "cat-books",
      sku: "BK-001",
      price: 180,
      costPrice: 120,
      stock: 42,
      reorderLevel: 12,
      unit: "pcs",
      description: "80-page ruled notebook"
    },
    {
      id: "prod-blue-pen",
      name: "Blue Ballpoint Pen",
      barcode: "890100000002",
      categoryId: "cat-stationery",
      sku: "ST-010",
      price: 60,
      costPrice: 32,
      stock: 9,
      reorderLevel: 15,
      unit: "pcs",
      description: "Smooth-writing pen"
    },
    {
      id: "prod-usb-cable",
      name: "USB-C Cable",
      barcode: "890100000003",
      categoryId: "cat-mobile",
      sku: "MB-204",
      price: 650,
      costPrice: 420,
      stock: 18,
      reorderLevel: 5,
      unit: "pcs",
      description: "1m charging cable"
    }
  ],
  suppliers: [
    {
      id: "sup-1",
      name: "Metro Wholesale",
      contactPerson: "Ruwan",
      phone: "0771234567",
      email: "metro@example.com",
      address: "Kandy Road, Colombo"
    },
    {
      id: "sup-2",
      name: "Paper Line Distributors",
      contactPerson: "Nimali",
      phone: "0717654321",
      email: "paperline@example.com",
      address: "Main Street, Gampaha"
    }
  ],
  purchaseOrders: [
    {
      id: "po-1001",
      supplierId: "sup-2",
      status: "pending",
      createdAt: "2026-05-02T09:30:00.000Z",
      receivedAt: null,
      notes: "Restock notebooks and pens",
      items: [
        { productId: "prod-notebook-a5", quantity: 20, costPrice: 118 },
        { productId: "prod-blue-pen", quantity: 40, costPrice: 30 }
      ]
    }
  ],
  sales: [
    {
      id: "sale-1001",
      cashierId: "user-cashier",
      createdAt: "2026-05-04T10:15:00.000Z",
      items: [
        { productId: "prod-notebook-a5", quantity: 2, price: 180, name: "A5 Notebook" },
        { productId: "prod-blue-pen", quantity: 3, price: 60, name: "Blue Ballpoint Pen" }
      ],
      subtotal: 540,
      total: 540,
      paymentMethod: "cash"
    },
    {
      id: "sale-1002",
      cashierId: "user-cashier",
      createdAt: "2026-05-05T07:45:00.000Z",
      items: [
        { productId: "prod-usb-cable", quantity: 1, price: 650, name: "USB-C Cable" },
        { productId: "prod-notebook-a5", quantity: 1, price: 180, name: "A5 Notebook" }
      ],
      subtotal: 830,
      total: 830,
      paymentMethod: "cash"
    }
  ]
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeStore(store) {
  const normalized = clone(store);
  normalized.users = (normalized.users || []).map((user) => ({
    ...user,
    passwordHash: user.passwordHash || hashPassword(user.password || "changeme")
  }));
  normalized.meta = {
    currency: "LKR",
    appName: "StoreBuddy",
    lastBackupAt: null,
    lastRestoredAt: null,
    ...normalized.meta
  };
  normalized.categories ??= [];
  normalized.products ??= [];
  normalized.suppliers ??= [];
  normalized.purchaseOrders ??= [];
  normalized.sales ??= [];
  return normalized;
}

export async function ensureStore() {
  try {
    await fs.access(dataFile);
  } catch {
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(defaultStore, null, 2));
  }
}

export async function readStore() {
  await ensureStore();
  const data = await fs.readFile(dataFile, "utf8");
  return normalizeStore(JSON.parse(data));
}

export async function writeStore(store) {
  const normalized = normalizeStore(store);
  await fs.writeFile(dataFile, JSON.stringify(normalized, null, 2));
  return normalized;
}

export async function withStore(updater) {
  const current = await readStore();
  const next = await updater(clone(current));
  return writeStore(next);
}

export function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
