import { useEffect, useMemo, useState } from "react";

const tabs = [
  { id: "dashboard", label: "Dashboard", roles: ["admin", "cashier", "stock_handler"] },
  { id: "pos", label: "POS", roles: ["admin", "cashier"] },
  { id: "inventory", label: "Inventory", roles: ["admin", "stock_handler"] },
  { id: "suppliers", label: "Suppliers", roles: ["admin", "stock_handler"] },
  { id: "orders", label: "Purchase Orders", roles: ["admin", "stock_handler"] },
  { id: "reports", label: "Reports", roles: ["admin", "cashier", "stock_handler"] },
  { id: "users", label: "Users", roles: ["admin"] },
  { id: "backup", label: "Backup", roles: ["admin"] }
];

const demoAccounts = [
  { username: "admin", password: "admin123", role: "Admin" },
  { username: "cashier", password: "cashier123", role: "Cashier" },
  { username: "stock", password: "stock123", role: "Stock Handler" }
];

function currency(value) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

async function api(path, options = {}, token) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(error.message || "Request failed.");
  }

  return response.json();
}

function emptyProduct() {
  return {
    name: "",
    barcode: "",
    sku: "",
    categoryId: "",
    price: 0,
    costPrice: 0,
    stock: 0,
    reorderLevel: 0,
    unit: "pcs",
    description: ""
  };
}

function emptySupplier() {
  return {
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: ""
  };
}

function emptyUser() {
  return {
    name: "",
    username: "",
    role: "cashier",
    password: "",
    active: true
  };
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("storebuddy-token") || "");
  const [user, setUser] = useState(null);
  const [boot, setBoot] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct());
  const [supplierForm, setSupplierForm] = useState(emptySupplier());
  const [userForm, setUserForm] = useState(emptyUser());
  const [purchaseOrderForm, setPurchaseOrderForm] = useState({
    supplierId: "",
    notes: "",
    items: [{ productId: "", quantity: 1, costPrice: 0 }]
  });
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [backupText, setBackupText] = useState("");

  const roleTabs = useMemo(
    () => tabs.filter((tab) => (user ? tab.roles.includes(user.role) : false)),
    [user]
  );

  async function loadBootstrap(currentToken = token) {
    if (!currentToken) {
      return;
    }

    setLoading(true);
    try {
      const data = await api("/api/bootstrap", {}, currentToken);
      const me = await api("/api/auth/me", {}, currentToken);
      setBoot(data);
      setUser(me.user);
      setError("");
      if (!tabs.find((tab) => tab.id === activeTab && tab.roles.includes(me.user.role))) {
        setActiveTab("dashboard");
      }
    } catch (loadError) {
      setError(loadError.message);
      setToken("");
      setUser(null);
      setBoot(null);
      localStorage.removeItem("storebuddy-token");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadBootstrap(token);
    }
  }, [token]);

  function flash(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  }

  async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password")
        })
      });
      setToken(data.token);
      localStorage.setItem("storebuddy-token", data.token);
      flash("Signed in successfully.");
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setBoot(null);
    localStorage.removeItem("storebuddy-token");
  }

  async function saveProduct(event) {
    event.preventDefault();
    const path = productForm.id ? `/api/products/${productForm.id}` : "/api/products";
    const method = productForm.id ? "PUT" : "POST";
    const next = await api(
      path,
      {
        method,
        body: JSON.stringify(productForm)
      },
      token
    );
    setBoot((current) => ({ ...current, products: next, summary: summarizeLocal({ ...current, products: next }) }));
    setProductForm(emptyProduct());
    flash(productForm.id ? "Product updated." : "Product added.");
  }

  async function saveSupplier(event) {
    event.preventDefault();
    const path = supplierForm.id ? `/api/suppliers/${supplierForm.id}` : "/api/suppliers";
    const method = supplierForm.id ? "PUT" : "POST";
    const next = await api(
      path,
      {
        method,
        body: JSON.stringify(supplierForm)
      },
      token
    );
    setBoot((current) => ({ ...current, suppliers: next, summary: { ...current.summary, supplierCount: next.length } }));
    setSupplierForm(emptySupplier());
    flash(supplierForm.id ? "Supplier updated." : "Supplier added.");
  }

  async function saveUser(event) {
    event.preventDefault();
    const path = userForm.id ? `/api/users/${userForm.id}` : "/api/users";
    const method = userForm.id ? "PUT" : "POST";
    const next = await api(
      path,
      {
        method,
        body: JSON.stringify(userForm)
      },
      token
    );
    setBoot((current) => ({ ...current, users: next }));
    setUserForm(emptyUser());
    flash(userForm.id ? "User updated." : "User added.");
  }

  async function addCategory(name) {
    if (!name.trim()) {
      return;
    }
    const next = await api(
      "/api/categories",
      {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: "" })
      },
      token
    );
    setBoot((current) => ({ ...current, categories: next }));
    flash("Category added.");
  }

  async function createSale() {
    if (!cart.length) {
      return;
    }
    const response = await api(
      "/api/sales",
      {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
          paymentMethod: "cash"
        })
      },
      token
    );
    setBoot((current) => ({
      ...current,
      products: response.products,
      sales: response.sales,
      summary: response.summary
    }));
    setCart([]);
    flash("Sale completed and stock updated.");
  }

  async function createPurchaseOrder(event) {
    event.preventDefault();
    const next = await api(
      "/api/purchase-orders",
      {
        method: "POST",
        body: JSON.stringify({
          supplierId: purchaseOrderForm.supplierId,
          notes: purchaseOrderForm.notes,
          items: purchaseOrderForm.items.filter((item) => item.productId)
        })
      },
      token
    );
    setBoot((current) => ({ ...current, purchaseOrders: next }));
    setPurchaseOrderForm({
      supplierId: "",
      notes: "",
      items: [{ productId: "", quantity: 1, costPrice: 0 }]
    });
    flash("Purchase order created.");
  }

  async function receiveOrder(orderId) {
    const response = await api(
      `/api/purchase-orders/${orderId}/receive`,
      {
        method: "POST"
      },
      token
    );
    setBoot((current) => ({
      ...current,
      purchaseOrders: response.purchaseOrders,
      products: response.products,
      summary: summarizeLocal({ ...current, purchaseOrders: response.purchaseOrders, products: response.products })
    }));
    flash("Purchase order received and stock updated.");
  }

  async function exportBackup() {
    const dump = await api("/api/backup/export", {}, token);
    setBackupText(JSON.stringify(dump, null, 2));
    flash("Backup exported to the panel.");
  }

  async function restoreBackup() {
    const payload = JSON.parse(backupText);
    await api(
      "/api/backup/restore",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      token
    );
    await loadBootstrap(token);
    flash("Backup restored.");
  }

  const filteredProducts = (boot?.products || []).filter((product) => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return true;
    }
    return [product.name, product.barcode, product.sku].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(needle)
    );
  });

  if (!token || !user || !boot) {
    return (
      <div className="login-shell">
        <div className="hero-card">
          <div>
            <p className="eyebrow">StoreBuddy</p>
            <h1>Inventory tracking and billing for a real small-shop workflow.</h1>
            <p className="lede">
              Built from the interim report as a local-first retail system with products, stock, billing,
              suppliers, purchase orders, reporting, and role-based access.
            </p>
          </div>
          <div className="demo-accounts">
            <h2>Demo Accounts</h2>
            {demoAccounts.map((account) => (
              <div key={account.username} className="demo-account">
                <strong>{account.role}</strong>
                <span>{account.username}</span>
                <span>{account.password}</span>
              </div>
            ))}
          </div>
        </div>

        <form className="panel login-panel" onSubmit={handleLogin}>
          <h2>Sign in</h2>
          <label>
            Username
            <input name="username" defaultValue="admin" required />
          </label>
          <label>
            Password
            <input name="password" type="password" defaultValue="admin123" required />
          </label>
          {error ? <p className="feedback error">{error}</p> : null}
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Enter StoreBuddy"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Retail Control Panel</p>
          <h1>StoreBuddy</h1>
          <p className="user-tag">
            {user.name} · {user.role.replace("_", " ")}
          </p>
        </div>

        <nav className="nav-list">
          {roleTabs.map((tab) => (
            <button
              key={tab.id}
              className={tab.id === activeTab ? "nav-item active" : "nav-item"}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <button className="ghost-button" onClick={logout} type="button">
          Sign out
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h2>{roleTabs.find((tab) => tab.id === activeTab)?.label}</h2>
            <p>Local-first operations, real-time stock updates, and role-aware workflows.</p>
          </div>
          <div className="topbar-meta">
            {message ? <span className="feedback success">{message}</span> : null}
            {error ? <span className="feedback error">{error}</span> : null}
          </div>
        </header>

        {activeTab === "dashboard" ? (
          <Dashboard summary={boot.summary} products={boot.products} sales={boot.sales} />
        ) : null}

        {activeTab === "inventory" ? (
          <section className="content-grid">
            <div className="panel">
              <h3>Products</h3>
              <form className="form-grid" onSubmit={saveProduct}>
                <label>
                  Product name
                  <input
                    value={productForm.name}
                    onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Barcode
                  <input
                    value={productForm.barcode}
                    onChange={(event) => setProductForm({ ...productForm, barcode: event.target.value })}
                  />
                </label>
                <label>
                  SKU
                  <input
                    value={productForm.sku}
                    onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={productForm.categoryId}
                    onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })}
                  >
                    <option value="">Select category</option>
                    {boot.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sell price
                  <input
                    type="number"
                    min="0"
                    value={productForm.price}
                    onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
                  />
                </label>
                <label>
                  Cost price
                  <input
                    type="number"
                    min="0"
                    value={productForm.costPrice}
                    onChange={(event) => setProductForm({ ...productForm, costPrice: event.target.value })}
                  />
                </label>
                <label>
                  Stock
                  <input
                    type="number"
                    min="0"
                    value={productForm.stock}
                    onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })}
                  />
                </label>
                <label>
                  Reorder level
                  <input
                    type="number"
                    min="0"
                    value={productForm.reorderLevel}
                    onChange={(event) => setProductForm({ ...productForm, reorderLevel: event.target.value })}
                  />
                </label>
                <label className="full-span">
                  Description
                  <textarea
                    rows="3"
                    value={productForm.description}
                    onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                  />
                </label>
                <div className="button-row full-span">
                  <button className="primary-button" type="submit">
                    {productForm.id ? "Update product" : "Add product"}
                  </button>
                  <button className="ghost-button" onClick={() => setProductForm(emptyProduct())} type="button">
                    Clear
                  </button>
                </div>
              </form>
            </div>

            <div className="panel">
              <div className="row-between">
                <h3>Categories</h3>
                <InlineAdd onSubmit={addCategory} placeholder="New category name" />
              </div>
              <div className="pill-grid">
                {boot.categories.map((category) => (
                  <span key={category.id} className="pill">
                    {category.name}
                  </span>
                ))}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Barcode</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boot.products.map((product) => (
                      <tr key={product.id} onClick={() => setProductForm(product)}>
                        <td>{product.name}</td>
                        <td>{product.barcode || "—"}</td>
                        <td>{currency(product.price)}</td>
                        <td>{product.stock}</td>
                        <td>
                          <span
                            className={
                              Number(product.stock) <= Number(product.reorderLevel) ? "status low" : "status good"
                            }
                          >
                            {Number(product.stock) <= Number(product.reorderLevel) ? "Low stock" : "Healthy"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "suppliers" ? (
          <section className="content-grid two-columns">
            <div className="panel">
              <h3>Supplier details</h3>
              <form className="form-grid" onSubmit={saveSupplier}>
                <label>
                  Name
                  <input
                    value={supplierForm.name}
                    onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Contact person
                  <input
                    value={supplierForm.contactPerson}
                    onChange={(event) => setSupplierForm({ ...supplierForm, contactPerson: event.target.value })}
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={supplierForm.phone}
                    onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })}
                  />
                </label>
                <label>
                  Email
                  <input
                    value={supplierForm.email}
                    onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })}
                  />
                </label>
                <label className="full-span">
                  Address
                  <textarea
                    rows="3"
                    value={supplierForm.address}
                    onChange={(event) => setSupplierForm({ ...supplierForm, address: event.target.value })}
                  />
                </label>
                <div className="button-row full-span">
                  <button className="primary-button" type="submit">
                    {supplierForm.id ? "Update supplier" : "Add supplier"}
                  </button>
                  <button className="ghost-button" onClick={() => setSupplierForm(emptySupplier())} type="button">
                    Clear
                  </button>
                </div>
              </form>
            </div>
            <div className="panel">
              <h3>Supplier directory</h3>
              <div className="stack-list">
                {boot.suppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    className="stack-card"
                    onClick={() => setSupplierForm(supplier)}
                    type="button"
                  >
                    <strong>{supplier.name}</strong>
                    <span>{supplier.contactPerson || "No contact person"}</span>
                    <span>{supplier.phone || "No phone number"}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "orders" ? (
          <section className="content-grid">
            <div className="panel">
              <h3>Create purchase order</h3>
              <form className="form-grid" onSubmit={createPurchaseOrder}>
                <label>
                  Supplier
                  <select
                    value={purchaseOrderForm.supplierId}
                    onChange={(event) =>
                      setPurchaseOrderForm({ ...purchaseOrderForm, supplierId: event.target.value })
                    }
                    required
                  >
                    <option value="">Select supplier</option>
                    {boot.suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="full-span">
                  Notes
                  <textarea
                    rows="3"
                    value={purchaseOrderForm.notes}
                    onChange={(event) => setPurchaseOrderForm({ ...purchaseOrderForm, notes: event.target.value })}
                  />
                </label>
                <div className="full-span stack-list compact">
                  {purchaseOrderForm.items.map((item, index) => (
                    <div className="inline-form" key={`po-item-${index}`}>
                      <select
                        value={item.productId}
                        onChange={(event) => updatePurchaseOrderItem(setPurchaseOrderForm, purchaseOrderForm, index, "productId", event.target.value)}
                      >
                        <option value="">Select product</option>
                        {boot.products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => updatePurchaseOrderItem(setPurchaseOrderForm, purchaseOrderForm, index, "quantity", event.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.costPrice}
                        onChange={(event) => updatePurchaseOrderItem(setPurchaseOrderForm, purchaseOrderForm, index, "costPrice", event.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="button-row full-span">
                  <button
                    className="ghost-button"
                    onClick={() =>
                      setPurchaseOrderForm({
                        ...purchaseOrderForm,
                        items: [...purchaseOrderForm.items, { productId: "", quantity: 1, costPrice: 0 }]
                      })
                    }
                    type="button"
                  >
                    Add item row
                  </button>
                  <button className="primary-button" type="submit">
                    Create order
                  </button>
                </div>
              </form>
            </div>
            <div className="panel">
              <h3>Order tracking</h3>
              <div className="stack-list">
                {boot.purchaseOrders.map((order) => {
                  const supplier = boot.suppliers.find((entry) => entry.id === order.supplierId);
                  return (
                    <div className="stack-card display-card" key={order.id}>
                      <div className="row-between">
                        <strong>{order.id}</strong>
                        <span className={order.status === "pending" ? "status low" : "status good"}>{order.status}</span>
                      </div>
                      <span>{supplier?.name || "Unknown supplier"}</span>
                      <span>{order.items.length} line items</span>
                      {order.status === "pending" ? (
                        <button className="primary-button small" onClick={() => receiveOrder(order.id)} type="button">
                          Mark received
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "pos" ? (
          <section className="content-grid">
            <div className="panel">
              <div className="row-between">
                <h3>Point of sale</h3>
                <input
                  className="search-input"
                  placeholder="Search by name, barcode, or SKU"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <button
                    className="product-card"
                    key={product.id}
                    onClick={() => addToCart(cart, setCart, product)}
                    type="button"
                  >
                    <strong>{product.name}</strong>
                    <span>{product.barcode || product.sku || "No code"}</span>
                    <span>{currency(product.price)}</span>
                    <span>{product.stock} in stock</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel">
              <h3>Current bill</h3>
              <div className="stack-list compact">
                {cart.length ? (
                  cart.map((item) => (
                    <div className="stack-card" key={item.id}>
                      <div className="row-between">
                        <strong>{item.name}</strong>
                        <span>{currency(item.quantity * item.price)}</span>
                      </div>
                      <div className="inline-form">
                        <button className="ghost-button small" onClick={() => shiftCart(setCart, item.id, -1)} type="button">
                          -
                        </button>
                        <input readOnly value={item.quantity} />
                        <button className="ghost-button small" onClick={() => shiftCart(setCart, item.id, 1)} type="button">
                          +
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Add products to build the current customer bill.</p>
                )}
              </div>
              <div className="bill-box">
                <div className="row-between">
                  <span>Total</span>
                  <strong>{currency(cart.reduce((sum, item) => sum + item.quantity * item.price, 0))}</strong>
                </div>
                <button className="primary-button" disabled={!cart.length} onClick={createSale} type="button">
                  Complete sale
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "reports" ? (
          <Reports boot={boot} />
        ) : null}

        {activeTab === "users" ? (
          <section className="content-grid two-columns">
            <div className="panel">
              <h3>User management</h3>
              <form className="form-grid" onSubmit={saveUser}>
                <label>
                  Full name
                  <input
                    value={userForm.name}
                    onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    value={userForm.username}
                    onChange={(event) => setUserForm({ ...userForm, username: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Role
                  <select
                    value={userForm.role}
                    onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
                  >
                    <option value="admin">Admin</option>
                    <option value="cashier">Cashier</option>
                    <option value="stock_handler">Stock Handler</option>
                  </select>
                </label>
                <label>
                  Password
                  <input
                    value={userForm.password}
                    onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                    placeholder={userForm.id ? "Leave blank to keep current password" : ""}
                  />
                </label>
                <div className="button-row full-span">
                  <button className="primary-button" type="submit">
                    {userForm.id ? "Update user" : "Add user"}
                  </button>
                  <button className="ghost-button" onClick={() => setUserForm(emptyUser())} type="button">
                    Clear
                  </button>
                </div>
              </form>
            </div>
            <div className="panel">
              <h3>Current users</h3>
              <div className="stack-list">
                {boot.users.map((entry) => (
                  <button key={entry.id} className="stack-card" onClick={() => setUserForm({ ...entry, password: "" })} type="button">
                    <strong>{entry.name}</strong>
                    <span>{entry.username}</span>
                    <span>{entry.role.replace("_", " ")}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "backup" ? (
          <section className="content-grid two-columns">
            <div className="panel">
              <h3>Backup and restore</h3>
              <p className="muted">
                This MVP exports the full system dataset as JSON so the store can perform manual backups and restore them later.
              </p>
              <div className="button-row">
                <button className="primary-button" onClick={exportBackup} type="button">
                  Export backup
                </button>
                <button className="ghost-button" onClick={restoreBackup} type="button">
                  Restore from panel
                </button>
              </div>
            </div>
            <div className="panel">
              <h3>Backup payload</h3>
              <textarea
                className="backup-box"
                rows="18"
                value={backupText}
                onChange={(event) => setBackupText(event.target.value)}
              />
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Dashboard({ summary, products, sales }) {
  const cards = [
    { label: "Today revenue", value: currency(summary.todayRevenue) },
    { label: "Today sales", value: summary.todaySalesCount },
    { label: "Products", value: summary.productCount },
    { label: "Stock value", value: currency(summary.stockValue) }
  ];

  return (
    <section className="content-grid">
      <div className="stats-grid">
        {cards.map((card) => (
          <div className="stat-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="row-between">
          <h3>Low stock alerts</h3>
          <span className="status low">{summary.lowStockCount} attention needed</span>
        </div>
        <div className="stack-list compact">
          {summary.lowStockItems.map((product) => (
            <div className="stack-card display-card" key={product.id}>
              <strong>{product.name}</strong>
              <span>
                {product.stock} left · reorder at {product.reorderLevel}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Recent sales</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sale</th>
                <th>Items</th>
                <th>Total</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 5).map((sale) => (
                <tr key={sale.id}>
                  <td>{sale.id}</td>
                  <td>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                  <td>{currency(sale.total)}</td>
                  <td>{new Date(sale.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3>Current inventory snapshot</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Stock</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.stock}</td>
                  <td>{currency(Number(product.stock) * Number(product.costPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Reports({ boot }) {
  const movement = summarizeLocal(boot);
  return (
    <section className="content-grid">
      <div className="panel">
        <h3>Fast-moving items</h3>
        <div className="stack-list compact">
          {movement.summary.fastMoving.map((item) => (
            <div className="stack-card display-card" key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.sold} units sold</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>Slow-moving items</h3>
        <div className="stack-list compact">
          {movement.summary.slowMoving.map((item) => (
            <div className="stack-card display-card" key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.sold} units sold</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h3>Sales summary</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transactions</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupSalesByDay(boot.sales)).map(([date, value]) => (
                <tr key={date}>
                  <td>{date}</td>
                  <td>{value.count}</td>
                  <td>{currency(value.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function InlineAdd({ onSubmit, placeholder }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
        setValue("");
      }}
    >
      <input placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} />
      <button className="ghost-button small" type="submit">
        Add
      </button>
    </form>
  );
}

function summarizeLocal(boot) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = boot.sales.filter((sale) => sale.createdAt.startsWith(today));
  const lowStockItems = boot.products.filter((product) => Number(product.stock) <= Number(product.reorderLevel));
  const stockValue = boot.products.reduce(
    (sum, product) => sum + Number(product.stock) * Number(product.costPrice || 0),
    0
  );
  const soldMap = new Map();
  for (const sale of boot.sales) {
    for (const item of sale.items) {
      soldMap.set(item.productId, (soldMap.get(item.productId) || 0) + Number(item.quantity));
    }
  }
  const movement = boot.products.map((product) => ({
    id: product.id,
    name: product.name,
    sold: soldMap.get(product.id) || 0
  }));

  return {
    ...boot,
    summary: {
      todayRevenue: todaySales.reduce((sum, sale) => sum + Number(sale.total), 0),
      todaySalesCount: todaySales.length,
      productCount: boot.products.length,
      supplierCount: boot.suppliers.length,
      lowStockCount: lowStockItems.length,
      stockValue,
      lowStockItems,
      fastMoving: [...movement].sort((a, b) => b.sold - a.sold).slice(0, 5),
      slowMoving: [...movement].sort((a, b) => a.sold - b.sold).slice(0, 5)
    }
  };
}

function groupSalesByDay(sales) {
  return sales.reduce((accumulator, sale) => {
    const day = sale.createdAt.slice(0, 10);
    accumulator[day] ??= { count: 0, total: 0 };
    accumulator[day].count += 1;
    accumulator[day].total += Number(sale.total);
    return accumulator;
  }, {});
}

function addToCart(cart, setCart, product) {
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    setCart(
      cart.map((item) =>
        item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item
      )
    );
    return;
  }
  setCart([...cart, { ...product, quantity: 1 }]);
}

function shiftCart(setCart, productId, delta) {
  setCart((current) =>
    current
      .map((item) => (item.id === productId ? { ...item, quantity: item.quantity + delta } : item))
      .filter((item) => item.quantity > 0)
  );
}

function updatePurchaseOrderItem(setForm, form, index, field, value) {
  const items = form.items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, [field]: value } : item
  );
  setForm({ ...form, items });
}
