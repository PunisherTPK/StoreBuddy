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
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getSuppliers,
  createSupplier,
  updateSupplier,
  getSupplier,
  supplierInUse,
  deleteSupplier,
  getUsers,
  getUserByUsername,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getCategories,
  createCategory,
  updateCategory,
  getCategory,
  categoryInUse,
  deleteCategory,
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
  getSales,
  getTopSellingProducts,
  createSale,
  exportBackup,
  restoreBackup,
  logActivity,
  getActivityLogs
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
  const date = new Date();
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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


app.get(
  "/api/activity-logs",
  authRequired,
  async (_req, res) => {
    const logs = await getActivityLogs(100);
    res.json(logs);
  }
);


app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await getUserByUsername(username);

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
  await logActivity({
      userId: user.id,
      action: "LOGIN",
      entity: "user",
      entityId: user.id,
      description: `${user.name} logged into StoreBuddy.`
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
  const user = await getUserById(req.auth.userId);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  res.json({ user: sanitizeUser(user) });
});

app.get("/api/bootstrap", authRequired, async (_req, res) => {
    const store = await readStore();
    const activityLogs = await getActivityLogs(100);
    const topSellingProducts = await getTopSellingProducts(5);

    res.json({
        meta: store.meta,
        summary: summarize(store),
        topSellingProducts,
        categories: store.categories,
        products: store.products,
        suppliers: store.suppliers,
        purchaseOrders: store.purchaseOrders,
        sales: store.sales,
        users: store.users.map(sanitizeUser),
        activityLogs
    });
});

app.get("/api/dashboard", authRequired, async (_req, res) => {
  const store = await readStore();
  const topSellingProducts = await getTopSellingProducts(5);
  res.json({
    ...summarize(store),
    topSellingProducts
  });
});

app.get("/api/alerts/low-stock", authRequired, async (_req, res) => {
  const products = await getProducts();
  const items = products.filter((product) => Number(product.stock) <= Number(product.reorderLevel));
  res.json(items);
});

app.get("/api/categories", authRequired, async (_req, res) => {
  res.json(await getCategories());
});

app.post("/api/categories", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  const category = {
    id: generateId("cat"),
    name: req.body.name,
    description: req.body.description || ""
  };

  await createCategory(category);
  await logActivity({
      userId: req.auth.userId,
      action: "CATEGORY_CREATED",
      entity: "category",
      entityId: category.id,
      description: `${req.auth.name} added category "${category.name}".`
  });
  res.status(201).json(await getCategories());
});

app.put("/api/categories/:id", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  await updateCategory(req.params.id, req.body);
  await logActivity({
      userId: req.auth.userId,
      action: "CATEGORY_UPDATED",
      entity: "category",
      entityId: req.params.id,
      description: `${req.auth.name} updated category "${req.body.name}".`
  });
  res.json(await getCategories());
});

app.delete(
  "/api/categories/:id",
  authRequired,
  allowRoles("admin"),
  async (req, res) => {

    const category = await getCategory(req.params.id);
    const inUse = await categoryInUse(req.params.id);

    if (inUse) {
      return res.status(400).json({
        message: "This category is assigned to one or more products."
      });
    }

    await deleteCategory(req.params.id);

    const categories = await getCategories();
    await logActivity({
        userId: req.auth.userId,
        action: "CATEGORY_DELETED",
        entity: "category",
        entityId: req.params.id,
        description: `${req.auth.name} deleted category "${category?.name || req.params.id}".`
    });
    res.json(categories);
  }
);


app.get("/api/products", authRequired, async (_req, res) => {
  res.json(await getProducts());
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
    await logActivity({
        userId: req.auth.userId,
        action: "PRODUCT_CREATED",
        entity: "product",
        entityId: product.id,
        description: `${req.auth.name} added product "${product.name}".`
    }); 
    const products = await getProducts();

    res.status(201).json(products);
  }
);

app.put("/api/products/:id", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  await updateProduct(req.params.id, req.body);
  await logActivity({
      userId: req.auth.userId,
      action: "PRODUCT_UPDATED",
      entity: "product",
      entityId: req.params.id,
      description: `${req.auth.name} updated product.`
  });
  const products = await getProducts();
  res.json(products);
});

app.delete("/api/products/:id", authRequired, allowRoles("admin"), async (req, res) => {
  await deleteProduct(req.params.id);
  await logActivity({
      userId: req.auth.userId,
      action: "PRODUCT_DELETED",
      entity: "product",
      entityId: req.params.id,
      description: `${req.auth.name} deleted a product.`
  });
  const products = await getProducts();
  res.json(products);
});

app.get("/api/suppliers", authRequired, async (_req, res) => {
  res.json(await getSuppliers());
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

  await createSupplier(supplier);

  res.status(201).json(await getSuppliers());
});

app.put("/api/suppliers/:id", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  await updateSupplier(req.params.id, req.body);

  res.json(await getSuppliers());
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

    const user = await getUserById(req.params.id);
    await deleteUser(req.params.id);

    const users = await getUsers();
    await logActivity({
        userId: req.auth.userId,
        action: "USER_DELETED",
        entity: "user",
        entityId: req.params.id,
        description: `${req.auth.name} deleted user "${user?.name || req.params.id}".`
    });
    res.json(users);
  }
);


app.delete(
  "/api/suppliers/:id",
  authRequired,
  allowRoles("admin"),
  async (req, res) => {

    const supplier = await getSupplier(req.params.id);
    const inUse = await supplierInUse(req.params.id);

    if (inUse) {
      return res.status(400).json({
        message: "This supplier is assigned to one or more products."
      });
    }

    await deleteSupplier(req.params.id);

    const suppliers = await getSuppliers();
    await logActivity({
        userId: req.auth.userId,
        action: "SUPPLIER_DELETED",
        entity: "supplier",
        entityId: req.params.id,
        description: `${req.auth.name} deleted supplier "${supplier?.name || req.params.id}".`
    });
    res.json(suppliers);
  }
);

app.get("/api/purchase-orders", authRequired, async (_req, res) => {
  res.json(await getPurchaseOrders());
});

app.post("/api/purchase-orders", authRequired, allowRoles("admin", "stock_handler"), async (req, res) => {
  const purchaseOrder = {
    id: generateId("po"),
    supplierId: req.body.supplierId,
    status: "pending",
    createdAt: new Date(),
    receivedAt: null,
    notes: req.body.notes || "",
    items: (req.body.items || []).map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity || 0),
      costPrice: Number(item.costPrice || 0)
    }))
  };

  await createPurchaseOrder(purchaseOrder);
  await logActivity({
    userId: req.auth.userId,
    action: "PURCHASE_ORDER_CREATED",
    entity: "purchaseOrder",
    entityId: purchaseOrder.id,
    description: `${req.auth.name} created purchase order "${purchaseOrder.id}".`
  });
  res.status(201).json(await getPurchaseOrders());
});

app.post(
  "/api/purchase-orders/:id/receive",
  authRequired,
  allowRoles("admin", "stock_handler"),
  async (req, res) => {
    await receivePurchaseOrder(req.params.id);
    await logActivity({
        userId: req.auth.userId,
        action: "PURCHASE_ORDER_RECEIVED",
        entity: "purchaseOrder",
        entityId: req.params.id,
        description: `${req.auth.name} received purchase order "${req.params.id}".`
    });
    res.json({
      purchaseOrders: await getPurchaseOrders(),
      products: await getProducts()
    });
  }
);

app.get("/api/sales", authRequired, async (_req, res) => {
  res.json(await getSales());
});

app.post("/api/sales", authRequired, allowRoles("admin", "cashier"), async (req, res) => {
  const payloadItems = req.body.items || [];
  let sale;

  try {
    sale = await createSale({
      id: generateId("sale"),
      cashierId: req.auth.userId,
      items: payloadItems,
      paymentMethod: req.body.paymentMethod || "cash"
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
    return;
  }

  await logActivity({
      userId: req.auth.userId,
      action: "SALE_COMPLETED",
      entity: "sale",
      entityId: sale.id,
      description: `${req.auth.name} completed Sale ${sale.id}.`
  });
  const store = await readStore();
  const topSellingProducts = await getTopSellingProducts(5);
  res.status(201).json({
    sales: store.sales,
    products: store.products,
    summary: summarize(store),
    topSellingProducts
  });
});

app.get("/api/reports/overview", authRequired, async (_req, res) => {
  const store = await readStore();
  res.json(summarize(store));
});

app.get("/api/users", authRequired, allowRoles("admin"), async (_req, res) => {
  const users = await getUsers();
  res.json(users.map(sanitizeUser));
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

  await createUser(user);
  await logActivity({
      userId: req.auth.userId,
      action: "USER_CREATED",
      entity: "user",
      entityId: user.id,
      description: `${req.auth.name} added user "${user.name}".`
  });
  const users = await getUsers();
  res.status(201).json(users.map(sanitizeUser));
});

app.put("/api/users/:id", authRequired, allowRoles("admin"), async (req, res) => {
  const hashedPassword = req.body.password
    ? await hashPassword(req.body.password)
    : null;

  const updates = { ...req.body };
  delete updates.password;
  if (hashedPassword) {
    updates.passwordHash = hashedPassword;
  }
  await updateUser(req.params.id, updates);

  await logActivity({
      userId: req.auth.userId,
      action: "USER_UPDATED",
      entity: "user",
      entityId: req.params.id,
      description: `${req.auth.name} updated user "${req.params.id}".`
  });

  const users = await getUsers();
  res.json(users.map(sanitizeUser));
});


app.get("/api/backup/export", authRequired, allowRoles("admin"), async (_req, res) => {
  const store = await exportBackup();
  res.json(store);
});

app.post("/api/backup/restore", authRequired, allowRoles("admin"), async (req, res) => {
  const store = await restoreBackup(req.body);
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
