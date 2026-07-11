import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createToken,
  hashPassword,
  verifyPassword,
  verifyToken
} from "./auth.js";

import {
  generateId,
  readStore,
  withStore,
  writeStore,
  createProduct,
  getProducts,
  getSuppliers,
  deleteSupplier,
  getUsers,
  deleteUser
} from "./storeProvider.js";



const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");

app.use(cors());
app.use(express.json({ limit: "5mb" }));

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function summarize(store) {
  const today = getTodayIso();
  const todaySales = store.sales.filter((sale) => sale.createdAt.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const lowStockItems = store.products.filter((product) => Number(product.stock) <= Number(product.reorderLevel));
  const stockValue = store.products.reduce(
    (sum, product) => sum + Number(product.stock) * Number(product.costPrice || 0),
    0
  );

  const movement = new Map();
  for (const sale of store.sales) {
    for (const item of sale.items) {
      movement.set(item.productId, (movement.get(item.productId) || 0) + Number(item.quantity));
    }
  }

  const productsWithMovement = store.products.map((product) => ({
    id: product.id,
    name: product.name,
    sold: movement.get(product.id) || 0
  }));

  const fastMoving = [...productsWithMovement].sort((a, b) => b.sold - a.sold).slice(0, 5);
  const slowMoving = [...productsWithMovement].sort((a, b) => a.sold - b.sold).slice(0, 5);

  return {
    todayRevenue,
    todaySalesCount: todaySales.length,
    productCount: store.products.length,
    supplierCount: store.suppliers.length,
    lowStockCount: lowStockItems.length,
    stockValue,
    lowStockItems,
    fastMoving,
    slowMoving
  };
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verifyToken(token);

  if (!payload?.userId) {
    return res.status(401).json({ message: "Authentication required." });
  }

  req.auth = payload;
  next();
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "You do not have permission for this action." });
    }
    next();
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const store = await readStore();
  const user = store.users.find((entry) => entry.username === username && entry.active);

  if (!user) {
    return res.status(401).json({ message: "Invalid username." });
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    return res.status(401).json({ message: "Invalid password." });
  }
  

  const safeUser = sanitizeUser(user);
  const token = createToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    username: user.username
  });

  res.json({
    token,
    user: safeUser,
    demoAccounts: [
      { username: "admin", password: "admin123", role: "admin" },
      { username: "cashier", password: "cashier123", role: "cashier" },
      { username: "stock", password: "stock123", role: "stock_handler" }
    ]
  });
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  const store = await readStore();
  const user = store.users.find((entry) => entry.id === req.auth.userId);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({ user: sanitizeUser(user) });
});

app.get("/api/bootstrap", authRequired, async (_req, res) => {
  const store = await readStore();
  res.json({
    meta: store.meta,
    summary: summarize(store),
    categories: store.categories,
    products: store.products,
    suppliers: store.suppliers,
    purchaseOrders: store.purchaseOrders,
    sales: store.sales,
    users: store.users.map(sanitizeUser)
  });
});

app.get("/api/dashboard", authRequired, async (_req, res) => {
  const store = await readStore();
  res.json(summarize(store));
});

app.get("/api/alerts/low-stock", authRequired, async (_req, res) => {
  const store = await readStore();
  const items = store.products.filter((product) => Number(product.stock) <= Number(product.reorderLevel));
  res.json(items);
});

app.get("/api/categories", authRequired, async (_req, res) => {
  const store = await readStore();
  res.json(store.categories);
});

app.post("/api/categories", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  const category = {
    id: generateId("cat"),
    name: req.body.name,
    description: req.body.description || ""
  };

  const store = await withStore(async (draft) => {
    draft.categories.unshift(category);
    return draft;
  });

  res.status(201).json(store.categories);
});

app.put("/api/categories/:id", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  const store = await withStore(async (draft) => {
    draft.categories = draft.categories.map((category) =>
      category.id === req.params.id ? { ...category, ...req.body } : category
    );
    return draft;
  });

  res.json(store.categories);
});

app.delete("/api/categories/:id", authRequired, allowRoles("admin"), async (req, res) => {
  const store = await withStore(async (draft) => {
    const category = draft.categories.find(
      (category) => category.id === req.params.id
    );

    if (!category) {
      return draft;
    }

    const inUse = draft.products.some(
      (product) =>
        product.active &&
        product.categoryId === req.params.id
    );

    if (inUse) {
      throw new Error("This category is assigned to one or more products.");
    }

    category.active = false;
    return draft;
  }).catch((error) => {
    res.status(400).json({ message: error.message });
    return null;
  });

  if (!store) {
    return;
  }

  res.json(store.categories);
});

app.get("/api/products", authRequired, async (_req, res) => {
  const store = await readStore();
  res.json(store.products);
});

app.post(
  "/api/products",
  authRequired,
  allowRoles("admin", "stock_handler"),
  async (req, res) => {
    const product = {
      id: generateId("prod"),
      name: req.body.name,
      barcode: req.body.barcode || "",
      sku: req.body.sku || "",
      categoryId: req.body.categoryId || "",
      supplierId: req.body.supplierId || "",
      price: Number(req.body.price || 0),
      costPrice: Number(req.body.costPrice || 0),
      stock: Number(req.body.stock || 0),
      reorderLevel: Number(req.body.reorderLevel || 0),
      unit: req.body.unit || "pcs",
      description: req.body.description || ""
    };

    await createProduct(product);

    const products = await getProducts();

    res.status(201).json(products);
  }
);

app.put("/api/products/:id", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  const store = await withStore(async (draft) => {
    draft.products = draft.products.map((product) =>
      product.id === req.params.id
        ? {
            ...product,
            ...req.body,

            categoryId: req.body.categoryId ?? product.categoryId,
            supplierId: req.body.supplierId ?? product.supplierId,
            active: product.active,

            price: Number(req.body.price ?? product.price),
            costPrice: Number(req.body.costPrice ?? product.costPrice),
            stock: Number(req.body.stock ?? product.stock),
            reorderLevel: Number(req.body.reorderLevel ?? product.reorderLevel)
          }
        : product
    );
    return draft;
  });

  const products = await getProducts();
  res.json(products);
});

app.delete("/api/products/:id", authRequired, allowRoles("admin"), async (req, res) => {
  const store = await withStore(async (draft) => {
    const product = draft.products.find(
      (product) => product.id === req.params.id
    );

    if (product) {
      product.active = false;
    }

    return draft;
  });

  const products = await getProducts();
  res.json(products);
});

app.get("/api/suppliers", authRequired, async (_req, res) => {
  const store = await readStore();
  res.json(store.suppliers);
});

app.post("/api/suppliers", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  const supplier = {
    id: generateId("sup"),
    name: req.body.name,
    contactPerson: req.body.contactPerson || "",
    phone: req.body.phone || "",
    email: req.body.email || "",
    address: req.body.address || "",
    active: true
  };

  const store = await withStore(async (draft) => {
    draft.suppliers.unshift(supplier);
    return draft;
  });

  res.status(201).json(store.suppliers);
});

app.put("/api/suppliers/:id", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  const store = await withStore(async (draft) => {
    draft.suppliers = draft.suppliers.map((supplier) =>
      supplier.id === req.params.id ? { ...supplier, ...req.body,active: supplier.active } : supplier
    );
    return draft;
  });

  res.json(store.suppliers);
});

app.delete(
  "/api/users/:id",
  authRequired,
  allowRoles("admin"),
  async (req, res) => {
    {/*
    // Prevent deleting yourself
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        message: "You cannot delete your own account."
      });
    }
    */}

    await deleteUser(req.params.id);

    const users = await getUsers();

    res.json(users);
  }
);


app.delete(
  "/api/suppliers/:id",
  authRequired,
  allowRoles("admin"),
  async (req, res) => {

    const store = await readStore();

    const inUse = store.products.some(
      (product) =>
        product.active &&
        product.supplierId === req.params.id
    );

    if (inUse) {
      return res.status(400).json({
        message: "This supplier is assigned to one or more products."
      });
    }

    await deleteSupplier(req.params.id);

    const suppliers = await getSuppliers();

    res.json(suppliers);
  }
);

app.get("/api/purchase-orders", authRequired, async (_req, res) => {
  const store = await readStore();
  res.json(store.purchaseOrders);
});

app.post("/api/purchase-orders", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  const purchaseOrder = {
    id: generateId("po"),
    supplierId: req.body.supplierId,
    status: "pending",
    createdAt: new Date().toISOString(),
    receivedAt: null,
    notes: req.body.notes || "",
    items: (req.body.items || []).map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity || 0),
      costPrice: Number(item.costPrice || 0)
    }))
  };

  const store = await withStore(async (draft) => {
    draft.purchaseOrders.unshift(purchaseOrder);
    return draft;
  });

  res.status(201).json(store.purchaseOrders);
});

app.post(
  "/api/purchase-orders/:id/receive",
  authRequired,
  allowRoles("admin", "stock_handler"),
  async (req, res) => {
    const store = await withStore(async (draft) => {
      const order = draft.purchaseOrders.find((entry) => entry.id === req.params.id);
      if (!order || order.status === "received") {
        return draft;
      }

      order.status = "received";
      order.receivedAt = new Date().toISOString();

      for (const item of order.items) {
        const product = draft.products.find((entry) => entry.id === item.productId);
        if (product) {
          product.stock = Number(product.stock) + Number(item.quantity);
          product.costPrice = Number(item.costPrice || product.costPrice);
        }
      }

      return draft;
    });

    res.json({
      purchaseOrders: store.purchaseOrders,
      products: store.products
    });
  }
);

app.get("/api/sales", authRequired, async (_req, res) => {
  const store = await readStore();
  res.json(store.sales);
});

app.post("/api/sales", authRequired, allowRoles("admin", "cashier"), async (req, res) => {
  const payloadItems = req.body.items || [];
  const store = await withStore(async (draft) => {
    const saleItems = payloadItems.map((item) => {
      const product = draft.products.find((entry) => entry.id === item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) {
        throw new Error("Quantity must be greater than zero.");
      }

      if (Number(product.stock) < quantity) {
        throw new Error(`Not enough stock for ${product.name}.`);
      }

      product.stock = Number(product.stock) - quantity;

      return {
        productId: product.id,
        quantity,
        price: Number(product.price),
        name: product.name
      };
    });

    const subtotal = saleItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const sale = {
      id: generateId("sale"),
      cashierId: req.auth.userId,
      createdAt: new Date().toISOString(),
      items: saleItems,
      subtotal,
      total: subtotal,
      paymentMethod: req.body.paymentMethod || "cash"
    };

    draft.sales.unshift(sale);
    return draft;
  }).catch((error) => {
    res.status(400).json({ message: error.message });
    return null;
  });

  if (!store) {
    return;
  }

  res.status(201).json({
    sales: store.sales,
    products: store.products,
    summary: summarize(store)
  });
});

app.get("/api/reports/overview", authRequired, async (_req, res) => {
  const store = await readStore();
  res.json(summarize(store));
});

app.get("/api/users", authRequired, allowRoles("admin"), async (_req, res) => {
  const store = await readStore();
  res.json(store.users.map(sanitizeUser));
});

app.post("/api/users", authRequired, allowRoles("admin"), async (req, res) => {
  const user = {
    id: generateId("user"),
    name: req.body.name,
    username: req.body.username,
    role: req.body.role,
    passwordHash: await hashPassword(req.body.password || "changeme123"),
    active: req.body.active ?? true
  };

  const store = await withStore(async (draft) => {
    draft.users.unshift(user);
    return draft;
  });

  res.status(201).json(store.users.map(sanitizeUser));
});

app.put("/api/users/:id", authRequired, allowRoles("admin"), async (req, res) => {
  const hashedPassword = req.body.password
    ? await hashPassword(req.body.password)
    : null;

  const store = await withStore(async (draft) => {
    draft.users = draft.users.map((user) => {
      if (user.id !== req.params.id) {
        return user;
      }

      return {
        ...user,
        ...req.body,
        passwordHash: hashedPassword ?? user.passwordHash
      };
    });

    return draft;
  });

  res.json(store.users.map(sanitizeUser));
});


app.get("/api/backup/export", authRequired, allowRoles("admin"), async (_req, res) => {
  const store = await readStore();
  store.meta.lastBackupAt = new Date().toISOString();
  await writeStore(store);
  res.json(store);
});

app.post("/api/backup/restore", authRequired, allowRoles("admin"), async (req, res) => {
  const next = req.body;
  next.meta = {
    ...next.meta,
    lastRestoredAt: new Date().toISOString()
  };
  const store = await writeStore(next);
  res.json({
    meta: store.meta,
    summary: summarize(store)
  });
});

if (process.env.NODE_ENV !== "production") {
  app.use(express.static(frontendDist));

  app.use((_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      name: "StoreBuddy Backend",
      status: "running"
    });
  });
}


app.listen(PORT, () => {
  console.log(`StoreBuddy backend running on http://localhost:${PORT}`);
});
