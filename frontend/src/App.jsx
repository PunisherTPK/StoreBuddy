import { useEffect, useMemo, useRef, useState } from "react";
import storebuddyLogo from "../src/logo2.jpeg";
import storebuddyLogo2 from "../src/storebuddy_logo2.png";
import { LogOut } from "lucide-react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from "chart.js";

import {
    Wallet,
    ShoppingCart,
    Package,
    Truck,
    TrendingUp
} from "lucide-react";

import { Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);


const API_URL = import.meta.env.VITE_API_URL || "";

const tabs = [
  { id: "dashboard", label: "Dashboard", roles: ["admin", "cashier", "stock_handler"], icon: HomeIcon },
  { id: "inventory", label: "Inventory", roles: ["admin", "stock_handler"], icon: BoxIcon },
  { id: "suppliers", label: "Suppliers", roles: ["admin", "stock_handler"], icon: TruckIcon },
  { id: "orders", label: "Purchase Orders", roles: ["admin", "stock_handler"], icon: ClipboardIcon },
  { id: "reports", label: "Reports", roles: ["admin", "cashier", "stock_handler"], icon: ChartIcon },
  { id: "users", label: "Users", roles: ["admin"], icon: UsersIcon },
  { id: "backup", label: "Backup", roles: ["admin"], icon: ShieldIcon },
  { id: "pos", label: "POS", roles: ["admin", "cashier"], icon: CartIcon/*,color: "#c7eb25", fontSize: "1.875rem"*/ }
];

const demoAccounts = [
  { username: "admin", password: "admin123", role: "Administrator" },
  { username: "cashier", password: "cashier123", role: "Cashier" },
  { username: "stock", password: "stock123", role: "Stock Handler" }
];

const accentThemes = [
  { id: "blue", label: "Blue" },
  { id: "emerald", label: "Emerald" },
  { id: "purple", label: "Purple" },
  { id: "orange", label: "Orange" },
  { id: "rose", label: "Rose" }
];

const modeThemes = [
  { id: "light", label: "Light mode" },
  { id: "dark", label: "Dark mode" }
];

function currency(value) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

async function api(path, options = {}, token) {
  const response = await fetch(`${API_URL}${path}`, {
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
    supplierId: "",
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

function emptyPurchaseOrder() {
  return {
    supplierId: "",
    notes: "",
    items: [{ productId: "", quantity: 1, costPrice: 0 }]
  };
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("storebuddy-token") || "");
  const [user, setUser] = useState(null);
  const [boot, setBoot] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(localStorage.getItem("storebuddy-sidebar-collapsed") === "true");
  const [globalSearch, setGlobalSearch] = useState("");
  const [themeMode, setThemeMode] = useState("dark");
  //const [themeMode, setThemeMode] = useState(localStorage.getItem("storebuddy-theme-mode") || "dark");
  //const [accentTheme, setAccentTheme] = useState(localStorage.getItem("storebuddy-accent-theme") || "blue");
  const [accentTheme, setAccentTheme] = useState("blue");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct());
  const [supplierForm, setSupplierForm] = useState(emptySupplier());
  const [userForm, setUserForm] = useState(emptyUser());
  const [purchaseOrderForm, setPurchaseOrderForm] = useState(emptyPurchaseOrder());
  const [cart, setCart] = useState([]);
  const [backupText, setBackupText] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [posNotice, setPosNotice] = useState(null);
  const isPos = activeTab === "pos";
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    products: { key: "name", direction: "asc" },
    sales: { key: "createdAt", direction: "desc" },
    users: { key: "name", direction: "asc" }
  });
  const [toasts, setToasts] = useState([]);

  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const barcodeInputRef = useRef(null);
  const themeMenuRef = useRef(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const stockChartRef = useRef(null);
  const [focusedProductId, setFocusedProductId] = useState("");

  const roleTabs = useMemo(
    () => tabs.filter((tab) => (user ? tab.roles.includes(user.role) : false)),
    [user]
  );

  const currentTab = roleTabs.find((tab) => tab.id === activeTab) || roleTabs[0];
  const searchQuery = globalSearch.trim().toLowerCase();
  const searchConfig = getSearchConfig(activeTab);

  const filteredProducts = useMemo(() => {
    const products = boot?.products || [];
    const query = searchQuery;
    if (!query) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.barcode, product.sku]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [boot?.products, searchQuery]);

  const filteredSuppliers = useMemo(() => {
    const suppliers = boot?.suppliers || [];
    if (!searchQuery) {
      return suppliers;
    }

    return suppliers.filter((supplier) =>
      [supplier.name, supplier.contactPerson, supplier.phone, supplier.email, supplier.address]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchQuery))
    );
  }, [boot?.suppliers, searchQuery]);

  const filteredUsers = useMemo(() => {
    const users = boot?.users || [];
    if (!searchQuery) {
      return users;
    }

    return users.filter((entry) =>
      [entry.name, entry.username, entry.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchQuery))
    );
  }, [boot?.users, searchQuery]);

  const filteredOrders = useMemo(() => {
    const orders = boot?.purchaseOrders || [];
    if (!searchQuery) {
      return orders;
    }

    return orders.filter((order) => {
      const supplierName = boot?.suppliers?.find((supplier) => supplier.id === order.supplierId)?.name || "";
      return [order.id, order.status, order.notes, supplierName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchQuery));
    });
  }, [boot?.purchaseOrders, boot?.suppliers, searchQuery]);

  const sortedProducts = useMemo(() => {
    return sortRows(filteredProducts, sortConfig.products);
  }, [filteredProducts, sortConfig.products]);

  const sortedUsers = useMemo(() => {
    return sortRows(filteredUsers, sortConfig.users);
  }, [filteredUsers, sortConfig.users]);

  const recentSales = useMemo(() => {
    return sortRows(boot?.sales || [], sortConfig.sales).slice(0, 8);
  }, [boot?.sales, sortConfig.sales]);

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
      setActivityLogs(data.activityLogs ?? []);
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

  useEffect(() => {
    document.documentElement.dataset.mode = themeMode;
    localStorage.setItem("storebuddy-theme-mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.accent = accentTheme;
    localStorage.setItem("storebuddy-accent-theme", accentTheme);
  }, [accentTheme]);

  useEffect(() => {
    localStorage.setItem("storebuddy-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (activeTab === "pos" && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [activeTab, boot]);

  useEffect(() => {
    function onPointerDown(event) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setThemeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pushToast(text, tone = "success") {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((current) => [...current, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }

  function flash(text) {
    pushToast(text, "success");
  }

  function showPosNotice(text, tone = "error") {
    const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setPosNotice({ id, text, tone });
    window.setTimeout(() => {
      setPosNotice((current) => (current?.id === id ? null : current));
    }, 1400);
  }

  function playErrorBeep() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "square";
      oscillator.frequency.value = 420;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.13);
      oscillator.onended = () => {
        context.close().catch(() => { });
      };
    } catch {
      // Ignore audio failures; the visual warning still covers the UX.
    }
  }

  function playSuccessBeep() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      const context = new AudioContextClass();
      const gain = context.createGain();
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, context.currentTime);

      const first = context.createOscillator();
      first.type = "sine";
      first.frequency.value = 880;
      first.connect(gain);

      const second = context.createOscillator();
      second.type = "sine";
      second.frequency.value = 1174;
      second.connect(gain);

      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);

      first.start(context.currentTime);
      first.stop(context.currentTime + 0.08);
      second.start(context.currentTime + 0.09);
      second.stop(context.currentTime + 0.19);

      second.onended = () => {
        context.close().catch(() => { });
      };
    } catch {
      // Ignore audio failures; the visual success state still covers the UX.
    }
  }

  async function runAction(key, action) {
    setBusyKey(key);
    setError("");
    try {
      await action();
    } catch (actionError) {
      pushToast(actionError.message, "error");
    } finally {
      setBusyKey("");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
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

  async function saveCategory(id) {
      const next = await api(
          `/api/categories/${id}`,
          {
              method: "PUT",
              body: JSON.stringify({
                  name: editingCategoryName
              })
          },
          token
      );

      setBoot(current => ({
          ...current,
          categories: next
      }));

      setEditingCategoryId(null);
      flash("Category updated.");
  }



  async function saveProduct(event) {
    event.preventDefault();
    await runAction("save-product", async () => {
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

      setBoot((current) => {
        const summary = summarizeLocal({ ...current, products: next }).summary;
        return { ...current, products: next, summary, topSellingProducts: syncTopSellingProducts(current.topSellingProducts, next) };
      });
      setProductForm(emptyProduct());
      setProductModalOpen(false);
      flash(productForm.id ? "Product updated." : "Product added.");
    });
  }
async function deleteProduct(product) {

    await runAction("delete-product", async () => {
        const next = await api(
            `/api/products/${product.id}`,
            {
                method: "DELETE"
            },
            token
        );

        setBoot(current => ({
            ...current,
            products: next,
            topSellingProducts: syncTopSellingProducts(current.topSellingProducts, next),
            summary: summarizeLocal({
                ...current,
                products: next
            }).summary
        }));

        flash("Product deleted.");
    });
}

async function deleteCategory(category) {
    await runAction("delete-category", async () => {

        const next = await api(
            `/api/categories/${category.id}`,
            {
                method: "DELETE"
            },
            token
        );

        setBoot(current => ({
            ...current,
            categories: next
        }));

        flash("Category deleted.");
    });
}


async function deleteSupplier(supplier) {
    await runAction("delete-supplier", async () => {
        const next = await api(
            `/api/suppliers/${supplier.id}`,
            {
                method: "DELETE"
            },
            token
        );

        setBoot(current => ({
            ...current,
            suppliers: next
        }));

        flash("Supplier deleted.");
    });
}

  async function saveSupplier(event) {
    event.preventDefault();
    await runAction("save-supplier", async () => {
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

      setBoot((current) => ({
        ...current,
        suppliers: next,
        summary: {
          ...current.summary,
          supplierCount: next.length
        }
      }));
      setSupplierForm(emptySupplier());
      setSupplierModalOpen(false);
      flash(supplierForm.id ? "Supplier updated." : "Supplier added.");
    });
  }

  async function saveUser(event) {
    event.preventDefault();
    await runAction("save-user", async () => {
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
      setUserModalOpen(false);
      flash(userForm.id ? "User updated." : "User added.");
    });
  }

  async function addCategory(name) {
    if (!name.trim()) {
      return;
    }

    await runAction("add-category", async () => {
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
    });
  }

  async function createSale() {
    if (!cart.length) {
      return;
    }

    await runAction("create-sale", async () => {
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
        summary: response.summary,
        topSellingProducts: response.topSellingProducts ?? syncTopSellingProducts(current.topSellingProducts, response.products)
      }));
      setCart([]);
      flash("Sale completed and stock updated.");
      window.setTimeout(() => barcodeInputRef.current?.focus(), 40);
    });
  }
  async function deleteUser(user) {
      await runAction("delete-user", async () => {

          const next = await api(
              `/api/users/${user.id}`,
              {
                  method: "DELETE"
              },
              token
          );

          setBoot(current => ({
              ...current,
              users: next
          }));

          flash("User deleted.");
      });
  }


  async function createPurchaseOrder(event) {
    event.preventDefault();
    await runAction("create-order", async () => {
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
      setPurchaseOrderForm(emptyPurchaseOrder());
      flash("Purchase order created.");
    });
  }

  async function receiveOrder(orderId) {
    await runAction(`receive-${orderId}`, async () => {
      const response = await api(
        `/api/purchase-orders/${orderId}/receive`,
        {
          method: "POST"
        },
        token
      );

      setBoot((current) => {
        const summary = summarizeLocal({
          ...current,
          purchaseOrders: response.purchaseOrders,
          products: response.products
        }).summary;

        return {
          ...current,
          purchaseOrders: response.purchaseOrders,
          products: response.products,
          topSellingProducts: syncTopSellingProducts(current.topSellingProducts, response.products),
          summary
        };
      });
      flash("Purchase order received and stock updated.");
    });
  }

  async function exportBackup() {
    await runAction("export-backup", async () => {
      const dump = await api("/api/backup/export", {}, token);
      setBackupText(JSON.stringify(dump, null, 2));
      flash("Backup exported.");
    });
  }

  async function restoreBackup() {
    await runAction("restore-backup", async () => {
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
    });
  }

  function openNewProductModal() {
    setProductForm(emptyProduct());
    setProductModalOpen(true);
  }

  function openEditProductModal(product) {
    setProductForm(product);
    setProductModalOpen(true);
  }

  function openProductInInventory(product) {
    setFocusedProductId(product.id);
    setGlobalSearch("");
    setActiveTab("inventory");
  }

  function openNewSupplierModal() {
    setSupplierForm(emptySupplier());
    setSupplierModalOpen(true);
  }

  function openEditSupplierModal(supplier) {
    setSupplierForm(supplier);
    setSupplierModalOpen(true);
  }

  function openNewUserModal() {
    setUserForm(emptyUser());
    setUserModalOpen(true);
  }

  function openEditUserModal(entry) {
    setUserForm({ ...entry, password: "" });
    setUserModalOpen(true);
  }

  function onSort(tableKey, key) {
    setSortConfig((current) => {
      const active = current[tableKey];
      const direction = active?.key === key && active?.direction === "asc" ? "desc" : "asc";
      return { ...current, [tableKey]: { key, direction } };
    });
  }

  function handlePosBarcodeSubmit() {
    const value = globalSearch.trim();
    if (!value) {
      return;
    }

    const matchedProduct = (boot?.products || []).find((product) => String(product.barcode || "").trim() === value);

    if (!matchedProduct) {
      playErrorBeep();
      showPosNotice(`No inventory item found for barcode ${value}.`, "error");
      return;
    }

    addToCart(cart, setCart, matchedProduct);
    playSuccessBeep();
    setGlobalSearch("");
    showPosNotice(`${matchedProduct.name} added to bill.`, "success");
    window.setTimeout(() => barcodeInputRef.current?.focus(), 20);
  }

  if (!token || !user || !boot) {
    return (
      <LoginScreen
        demoAccounts={demoAccounts}
        error={error}
        loading={loading}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className="page-shell h-screen overflow-hidden">
      <div className="flex h-screen overflow-hidden">
        {!isPos && (
          <Sidebar
            activeTab={activeTab}
            collapsed={sidebarCollapsed}
            onLogout={logout}
            onClose={() => setSidebarOpen(false)}
            onSelect={(tabId) => {
              setActiveTab(tabId);
              setSidebarOpen(false);
            }}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            open={sidebarOpen}
            tabs={roleTabs}
            user={user}
          />
          )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!isPos && (
            <TopBar
              activeTab={currentTab}
              accentTheme={accentTheme}
              error={error}
              onAccentThemeChange={setAccentTheme}
              onLogout={logout}
              onMenu={() => setSidebarOpen(true)}
              onModeChange={setThemeMode}
              onSearch={setGlobalSearch}
              searchConfig={searchConfig}
              searchValue={globalSearch}
              themeMenuOpen={themeMenuOpen}
              themeMenuRef={themeMenuRef}
              themeMode={themeMode}
              toggleThemeMenu={() => setThemeMenuOpen((current) => !current)}
              user={user}
            />
          )}

          <main className={`flex-1 overflow-hidden ${isPos? "p-4": "px-4 pb-6 pt-4 sm:px-6 lg:px-8"}`}>         
            <div className="flex h-full min-h-0 flex-col gap-6">
              {loading ? <LoadingBanner label="Refreshing dashboard data..." /> : null}

              <div className="min-h-0 flex-1 overflow-hidden">
                {activeTab === "dashboard" ? (
                  <ScreenScrollArea>
                    <DashboardScreen 
                    summary={boot.summary} 
                    products={boot.products} 
                    sales={recentSales} 
                    categories={boot.categories} 
                    activityLogs={activityLogs}
                    topSellingProducts={boot.topSellingProducts ?? []}
                    onProductSelect={openProductInInventory}
                    stockChartData={boot.stockChartData}
                    stockChartRef={stockChartRef}
                    categoryChartData={boot.categoryChartData} />
                  </ScreenScrollArea>
                ) : null}

                {activeTab === "inventory" ? (
                  <ScreenScrollArea>
                    <InventoryScreen
                      busy={busyKey}
                      categories={boot.categories}
                      suppliers={boot.suppliers}
                      onAddCategory={addCategory}
                      onEditProduct={openEditProductModal}
                      onDeleteProduct={deleteProduct}
                      onDeleteCategory={deleteCategory}
                      setDeleteDialog={setDeleteDialog}
                      onNewProduct={openNewProductModal}
                      onSort={onSort}
                      products={sortedProducts}
                      focusedProductId={focusedProductId}
                      sortConfig={sortConfig.products}
                      editingCategoryId={editingCategoryId}
                      setEditingCategoryId={setEditingCategoryId}
                      editingCategoryName={editingCategoryName}
                      setEditingCategoryName={setEditingCategoryName}
                      saveCategory={saveCategory}
                    />
                  </ScreenScrollArea>
                ) : null}

                {activeTab === "suppliers" ? (
                  <ScreenScrollArea>
                    <SuppliersScreen
                      onEditSupplier={openEditSupplierModal}
                      onNewSupplier={openNewSupplierModal}
                      onDeleteSupplier={deleteSupplier}
                      setDeleteDialog={setDeleteDialog}
                      suppliers={filteredSuppliers}
                    />
                  </ScreenScrollArea>
                ) : null}

                {activeTab === "orders" ? (
                  <ScreenScrollArea>
                    <OrdersScreen
                      busyKey={busyKey}
                      form={purchaseOrderForm}
                      onChange={setPurchaseOrderForm}
                      onReceiveOrder={receiveOrder}
                      onSubmit={createPurchaseOrder}
                      products={boot.products}
                      purchaseOrders={filteredOrders}
                      suppliers={boot.suppliers}
                    />
                  </ScreenScrollArea>
                ) : null}

                {activeTab === "pos" ? (
                  <div className="h-full">
                    <PosTopBar
                      logoSrc={storebuddyLogo}
                      onExit={() => setActiveTab("dashboard")}
                      user={user.name}
                    />
                    <PosScreen
                      barcodeInputRef={barcodeInputRef}
                      busyKey={busyKey}
                      cart={cart}
                      onAddToCart={(product) => addToCart(cart, setCart, product)}
                      onBarcodeSubmit={handlePosBarcodeSubmit}
                      onCheckout={createSale}
                      onQuantityChange={(productId, delta) => shiftCart(setCart, productId, delta)}
                      posNotice={posNotice}
                      products={filteredProducts}
                      searchValue={globalSearch}
                      setSearchValue={setGlobalSearch}
                      onExit={() => setActiveTab("dashboard")}
                    />
                  </div>
                ) : null}

                {activeTab === "reports" ? (
                  <ScreenScrollArea>
                    <ReportsScreen boot={boot} />
                  </ScreenScrollArea>
                ) : null}

                {activeTab === "users" ? (
                  <ScreenScrollArea>
                    <UsersScreen
                      onEditUser={openEditUserModal}
                      onNewUser={openNewUserModal}
                      onSort={onSort}
                      sortConfig={sortConfig.users}
                      users={sortedUsers}
                      onDeleteUser={deleteUser}
                      setDeleteDialog={setDeleteDialog}
                    />
                  </ScreenScrollArea>
                ) : null}

                {activeTab === "backup" ? (
                  <ScreenScrollArea>
                    <BackupScreen
                      backupText={backupText}
                      busyKey={busyKey}
                      onBackupTextChange={setBackupText}
                      onExport={exportBackup}
                      onRestore={restoreBackup}
                    />
                  </ScreenScrollArea>
                ) : null}
              </div>
            </div>
          </main>
        </div>
      </div>

      <EntityModal
        open={productModalOpen}
        title={productForm.id ? "Edit Product" : "Add Product"}
        subtitle="Maintain clean inventory data with faster product entry."
        onClose={() => setProductModalOpen(false)}
      >
        <ProductForm
            busy={busyKey === "save-product"}
            categories={boot.categories}
            suppliers={boot.suppliers}
            form={productForm}
            onChange={setProductForm}
            onSubmit={saveProduct}
        />
      </EntityModal>

      <EntityModal
        open={supplierModalOpen}
        title={supplierForm.id ? "Edit Supplier" : "Add Supplier"}
        subtitle="Keep supplier records tidy and ready for replenishment workflows."
        onClose={() => setSupplierModalOpen(false)}
      >
        <SupplierForm
          busy={busyKey === "save-supplier"}
          form={supplierForm}
          onChange={setSupplierForm}
          onSubmit={saveSupplier}
        />
      </EntityModal>

      <EntityModal
        open={userModalOpen}
        title={userForm.id ? "Edit User" : "Add User"}
        subtitle="Assign roles without changing your existing permission logic."
        onClose={() => setUserModalOpen(false)}
      >
        <UserForm
          busy={busyKey === "save-user"}
          form={userForm}
          onChange={setUserForm}
          onSubmit={saveUser}
        />
      </EntityModal>
      {deleteDialog && (
        <ConfirmDialog
            title={`Delete ${
                deleteDialog.type.charAt(0).toUpperCase() +
                deleteDialog.type.slice(1)
            }`}
            message={`Are you sure you want to delete "${deleteDialog.data.name}"?`}
            onCancel={() => setDeleteDialog(null)}
            onConfirm={async () => {

                switch (deleteDialog.type) {

                    case "product":
                        await deleteProduct(deleteDialog.data);
                        break;

                    case "supplier":
                        await deleteSupplier(deleteDialog.data);
                        break;

                    case "category":
                        await deleteCategory(deleteDialog.data);
                        break;

                    case "user":
                        await deleteUser(deleteDialog.data);
                        break;

                    default:
                        break;
                }

                setDeleteDialog(null);
            }}
        />
      )}
      <ToastViewport toasts={toasts} />
    </div>

  );
}

function LoginScreen({ demoAccounts, error, loading, onSubmit }) {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);

  return (
    <main className="min-h-screen flex flex-col md:flex-row relative" style={{ backgroundColor: "var(--app-bg)", color: "var(--text-strong)" }}>
      {/* Left Side: Content & Branding */}
      <section className="hidden md:flex md:w-1/2 flex-col justify-center p-8 lg:p-12 relative overflow-hidden" style={{ 
        background: "linear-gradient(135deg, rgba(var(--accent-rgb), 0.12), rgba(var(--accent-rgb), 0.08)), linear-gradient(180deg, #0f1f35, #1a2d4d)"
      }}>
        
        <div className="animated-glow glow-1" />
        <div className="animated-glow glow-2" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <div className="mb-8 flex items-center justify-left gap-6">
            <img
              src={storebuddyLogo}
              alt="StoreBuddy Logo"
              className="h-25 w-25 object-contain"
            />

            <div className="leading-tight">
              <h1
                className="text-5xl font-bold"
                style={{ color: "var(--text-strong)" }}
              >
                <span style={{ color: "var(--text-strong)" }}>Store</span>
                <span style={{ color: "var(--accent-600)" }}>Buddy</span>
              </h1>

              <p 
                className="text-sm font-medium"
                style={{ color: "var(--text-faint)", whiteSpace: 'pre-wrap' }}
              >
                Inventory   •   Billing   •   Growth
              </p>
            </div>
          </div>

          <header className="space-y-4">
            <h1 className="text-5xl leading-tight font-extrabold tracking-tight" style={{ color: "#ffffff" }}>
              Manage Your Store <span style={{ color: "var(--accent-500)" }}>Smarter.</span>
            </h1>
            <p className="text-lg leading-relaxed max-w-xl" style={{ color: "rgba(255, 255, 255, 0.9)" }}>
              Track inventory, manage suppliers, generate invoices, monitor stock levels, and grow your business with one powerful platform.
            </p>
          </header>

          {/* Feature Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { icon: "📦", label: "Smart Inventory" },
              { icon: "💳", label: "Fast POS Billing" },
              { icon: "🤝", label: "Supplier Management" },
              { icon: "📊", label: "Reports & Analytics" }
            ].map((feature, idx) => (
              <div key={idx} className="p-4 bg-white/10 border border-white/20 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 backdrop-blur-sm hover:bg-white/15">
                <div className="text-3xl mb-2">{feature.icon}</div>
                <h3 className="font-bold text-white text-base">{feature.label}</h3>
              </div>
            ))}
          </div>

          {/* Demo Accounts Info 
          <div className="pt-6">
            <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "rgba(255, 255, 255, 0.7)" }}>Demo Accounts</p>
            <div className="grid gap-3 md:grid-cols-3">
              {demoAccounts.map((account) => (
                <div key={account.username} className="rounded-xl border border-white/20 bg-white/8 p-3 backdrop-blur-sm">
                  <p className="text-xs font-semibold" style={{ color: "#ffffff" }}>{account.role}</p>
                  <p className="mt-2 text-xs" style={{ color: "rgba(255, 255, 255, 0.85)" }}>{account.username}</p>
                  <p className="text-xs font-mono" style={{ color: "rgba(255, 255, 255, 0.9)" }}>{account.password}</p>
                </div>
              ))}
            </div>
          </div> */}
        </div>
      </section>

      {/* Right Side: Login Form */}
      <section className="flex-1 flex flex-col justify-center items-center p-4 md:p-8 relative">
        {/* Mobile Brand Logo */}
        <div className="md:hidden absolute top-6 left-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden border border-white/20 bg-white/80 shadow-sm backdrop-blur-sm">
            <img src={storebuddyLogo} alt="StoreBuddy logo" className="h-full w-full object-contain" />
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="rounded-3xl border p-6 md:p-8 shadow-lg space-y-6" style={{ 
            background: "var(--surface-2)", 
            borderColor: "var(--border-soft)",
            backdropFilter: "blur(24px)"
          }}>
            <header className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden border border-white/20 bg-white/80 shadow-sm backdrop-blur-sm">
                  <img src={storebuddyLogo} alt="StoreBuddy logo" className="h-full w-full object-contain" />
                </div>
              </div>
              <h2 className="text-2xl font-extrabold" style={{ color: "var(--text-strong)" }}>Welcome Back</h2>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>Sign in to continue managing your business</p>
            </header>

            <form className="space-y-4" onSubmit={onSubmit}>
              {/* Username Field */}
              <div className="space-y-2">
                <label className="text-sm font-semibold block ml-1" style={{ color: "var(--text-soft)" }} htmlFor="username">
                  Username
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: "var(--text-faint)" }}>👤</span>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    defaultValue=""
                    placeholder=""
                    required
                    className="w-full pl-12 pr-4 py-3 rounded-xl font-base focus:ring-4 outline-none transition-all border"
                    style={{
                      backgroundColor: "var(--surface-3)",
                      borderColor: "var(--border-soft)",
                      color: "var(--text-strong)"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "var(--accent-500)"}
                    onBlur={(e) => e.target.style.borderColor = "var(--border-soft)"}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-sm font-semibold" style={{ color: "var(--text-soft)" }} htmlFor="password">
                    Password
                  </label>
                  {/*<a className="text-sm font-bold hover:underline transition-all" style={{ color: "var(--accent-600)" }} href="#">
                    Forgot Password?
                  </a> */}
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: "var(--text-faint)" }}>🔒</span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    defaultValue=""
                    placeholder=""
                    required
                    className="w-full pl-12 pr-12 py-3 rounded-xl font-base focus:ring-4 outline-none transition-all border"
                    style={{
                      backgroundColor: "var(--surface-3)",
                      borderColor: "var(--border-soft)",
                      color: "var(--text-strong)"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "var(--accent-500)"}
                    onBlur={(e) => e.target.style.borderColor = "var(--border-soft)"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Remember Me 
              <div className="flex items-center gap-2 px-1">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: "var(--accent-600)" }}
                />
                <label className="text-sm cursor-pointer select-none" style={{ color: "var(--text-faint)" }} htmlFor="remember">
                  Remember this device
                </label>
              </div>
              */}
              {/* Error Alert */}
              {error && (
                <div className="p-4 rounded-lg border" style={{ 
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                  color: "#dc2626"
                }}>
                  <p className="text-sm font-semibold">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-white text-base shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                style={{ 
                  background: "linear-gradient(135deg, var(--accent-600), var(--accent-700))",
                  boxShadow: "0 8px 16px rgba(var(--accent-rgb), 0.3)"
                }}
              >
                {loading ? "Signing in..." : "Login to StoreBuddy"}
              </button>
              {/*
              {/* Divider 
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t" style={{ borderColor: "var(--border-soft)" }}></div>
                <span className="flex-shrink mx-3 text-xs" style={{ color: "var(--text-soft)" }}>OR</span>
                <div className="flex-grow border-t" style={{ borderColor: "var(--border-soft)" }}></div>
              </div>
              
              {/* Demo Button 
              <button
                type="button"
                onClick={() => {
                  const form = event?.target?.closest("form");
                  if (form) {
                    form.dispatchEvent(new Event("submit", { bubbles: true }));
                  }
                }}
                className="w-full py-3 rounded-xl font-bold text-base border transition-all duration-200 flex items-center justify-center gap-2"
                style={{
                  borderColor: "var(--border-soft)",
                  color: "var(--accent-600)",
                  backgroundColor: "var(--surface-3)"
                }}
              >
                ⚡ Continue as Demo
              </button>
              */}
            </form>
            {/*
            <footer className="text-center pt-2">
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                Don't have an account? <a className="font-bold hover:underline" style={{ color: "var(--accent-600)" }} href="#">Get Started Free</a>
              </p>
            </footer>
            */}
          </div>
        </div>

        {/* Global Footer */}
        <footer className="absolute bottom-10 w-full text-center px-4">
          <p className="text-xs" style={{ color: "var(--text-faint)", opacity: 0.6 }}>
            © 2026 StoreBuddy. Built for Small Retail Businesses.
          </p>
        </footer>
      </section>

      <style>{`
        .animated-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          filter: blur(120px);
          z-index: 0;
          opacity: 0.15;
          pointer-events: none;
        }

        .glow-1 {
          background: radial-gradient(circle, rgba(var(--accent-rgb), 1) 0%, transparent 70%);
          top: -200px;
          left: -100px;
          animation: drift 15s infinite alternate ease-in-out;
        }

        .glow-2 {
          background: radial-gradient(circle, rgba(var(--accent-rgb), 0.6) 0%, transparent 70%);
          bottom: -200px;
          right: -100px;
          animation: drift 20s infinite alternate-reverse ease-in-out;
        }

        @keyframes drift {
          from { transform: translate(0, 0); }
          to { transform: translate(100px, 100px); }
        }
      `}</style>
    </main>
  );
}

function Sidebar({ activeTab, collapsed, onClose, onSelect, onToggleCollapsed, open, tabs, user,onLogout }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/40 transition lg:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r p-4 transition-all duration-300 lg:static lg:translate-x-0 relative ${collapsed ? "w-[96px]" : "w-60"
          } ${open ? "translate-x-0" : "-translate-x-full"
          }`}
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)", backdropFilter: "blur(18px)" }}
      >
        <div className="flex h-full flex-col">
          <div className={`mb-6 ${collapsed ? "flex flex-col items-center gap-4" : "flex items-start justify-between"}`}>
            <div className={collapsed ? "flex flex-col items-center" : ""}>
              <div className="flex items-center gap-3">
                <div
                  className={
                    collapsed
                      ? "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm transition-all duration-300 ease-out"
                      : "flex h-40 w-40 items-center justify-center rounded-2xl text-white shadow-sm transition-all duration-300 ease-out"
                  }
                  style={{ background: "linear-gradient(135deg, var(--accent-500), var(--accent-700))" }}
                >
                  <img src={storebuddyLogo2} alt="StoreBuddy Logo" className="h-full w-full object-contain" />
                </div>
                {/* Storebuddy in text 
                <div className={collapsed ? "hidden" : "block"}>
                  <h1 className="text-s font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--accent-700)" }}>Store</h1>
                  <h1 className="text-s font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--accent-700)" }}>Buddy</h1>
                </div>
                */}
              </div>
              <div className={`mt-5 rounded-[22px] p-1 ${collapsed ? "hidden" : "block"}`} style={{ background: "rgba(var(--accent-rgb), 0.08)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{user.name}</p>
                <p className="text-sm capitalize" style={{ color: "var(--text-faint)" }}>{user.role.replace("_", " ")}</p>
              </div>
            </div>
            <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
              <button className="btn-secondary px-3 py-2 lg:hidden" onClick={onClose} type="button">
                <CloseIcon />
              </button>
            </div>
            <button
              className="absolute -right-3 top-8 hidden h-7 w-7 items-center justify-center rounded-full border shadow-md transition hover:scale-105 lg:flex"
              onClick={onToggleCollapsed}
              style={{
                background: "var(--surface-1)",
                borderColor: "var(--border-soft)",
                color: "var(--text-soft)"
              }}
              type="button"
            >
              {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>
            <nav className="space-y-1.5">
              {tabs.filter((tab) => tab.id !== "pos").map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm transition ${collapsed ? "justify-center" : "gap-3"} ${active ? "font-bold shadow-lg" : "font-medium"}`}
                    style={
                      active
                        ? {
                            background: "linear-gradient(135deg, var(--accent-500), var(--accent-700))",
                            color: "#ffffff",
                            boxShadow: "0 6px 14px rgba(var(--accent-rgb), 0.35)",
                            //borderLeft: "4px solid #8f1616" 
                          }                            
                        : { color: "var(--text-soft)" }
                    }
                    onClick={() => onSelect(tab.id)}
                    type="button"
                  >
                    <Icon />
                    <span className={collapsed ? "hidden" : "block"}>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {(() => {
              const posTab = tabs.find((tab) => tab.id === "pos");
              const Icon = posTab.icon;
              const posActive = activeTab === "pos";
              return (
                <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border-soft)" }}>
                  <button
                    onClick={() => onSelect("pos")}
                    type="button"
                    className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-bold shadow-md transition hover:scale-[1.02] active:scale-[0.98] ${collapsed ? "justify-center" : "gap-3"}`}
                    style={{
                      background: posActive
                        ? "linear-gradient(135deg, #bef264, #65a30d)"
                        : "linear-gradient(135deg, #a3e635, #4d7c0f)",
                      color: "#0a0f1c"
                    }}
                  >
                    <Icon />
                    <span className={collapsed ? "hidden" : "block"}>{posTab.label}</span>
                  </button>
                </div>
              );
            })()}

            <button
              className={`group mt-auto flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all duration-200 hover:gap-3 text-[var(--text-soft)] hover:text-red-400 ${collapsed ? "justify-center" : "gap-3"}`}
              onClick={onLogout}
              type="button"
            >
              <LogOut className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
              <span className={collapsed ? "hidden" : "block"}>Sign out</span>
            </button>
          </div>
      </aside>
    </>
  );
}

function PosTopBar({
  user,
  onExit,
  logoSrc
}) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header
      className="mb-4 flex flex-col gap-4 rounded-2xl border px-4 shadow-lg md:flex-row md:items-center md:justify-between z-10"
      style={{
        backgroundColor: "#08101d",
        borderColor: "#000000"
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-4">
        <img
          src={logoSrc}
          alt="StoreBuddy"
          className="h-20 w-20 rounded-xl object-contain"
        />

        <div>
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            StoreBuddy POS
          </h1>

          <p
            className="text-sm"
            style={{ color: "var(--text-faint)" }}
          >
            Point of Sale
          </p>
        </div>
      </div>

      {/* Center */}
      <div className="flex items-center gap-6">
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
          style={{
            backgroundColor: "#10b98120",
            color: "#10b981"
          }}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          ONLINE
        </div>

        <div
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          👤 {user}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-60">
        <div className="text-right">
          <div
            className="text-lg font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {time.toLocaleTimeString()}
          </div>

          <div
            className="text-sm"
            style={{ color: "var(--text-faint)" }}
          >
            {time.toLocaleDateString(undefined, {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric"
            })}
          </div>
        </div>

        <button
          className="btn-secondary"
          onClick={onExit}
          type="button"
        >
          Exit POS
        </button>
      </div>
    </header>
  );
}





function TopBar({
  accentTheme,
  activeTab,
  error,
  onAccentThemeChange,
  onLogout,
  onMenu,
  onModeChange,
  onSearch,
  searchConfig,
  searchValue,
  themeMenuOpen,
  themeMenuRef,
  themeMode,
  toggleThemeMenu,
  user
}) {
  return (
    <header className="sticky top-0 z-20 border-b backdrop-blur-xl" style={{ borderColor: "var(--border-soft)", background: "color-mix(in oklab, var(--surface-2) 88%, transparent)" }}>
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <button className="btn-secondary px-3 py-2 lg:hidden" onClick={onMenu} type="button">
            <MenuIcon />
          </button>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>{activeTab?.label}</h2>
            {/* <p className="text-sm" style={{ color: "var(--text-faint)" }}>Production-style retail workspace with unchanged business logic underneath.</p> */}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {searchConfig.visible ? (
            <div className="relative min-w-0 md:w-80">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
                <SearchIcon />
              </span>
              <input
                className="input pl-10"
                onChange={(event) => onSearch(event.target.value)}
                placeholder={searchConfig.placeholder}
                value={searchValue}
              />
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div className="hidden rounded-2xl border px-4 py-2 md:block" style={{ borderColor: "var(--border-soft)", background: "var(--surface-3)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{user.name}</p>
              <p className="text-xs capitalize" style={{ color: "var(--text-faint)" }}>{user.role.replace("_", " ")}</p>
            </div>
            {/*
            <div className="relative" ref={themeMenuRef}>
              <button className="btn-secondary" onClick={toggleThemeMenu} type="button">
                <PaletteIcon />
                Theme
              </button>
              {themeMenuOpen ? (
                <ThemeMenu
                  accentTheme={accentTheme}
                  modeThemes={modeThemes}
                  onAccentThemeChange={onAccentThemeChange}
                  onModeChange={onModeChange}
                  themeMode={themeMode}
                />
              ) : null}
            </div>
            */}
          </div>
        </div>
      </div>
    </header>
  );
}

const chartColors = [
    "#6366F1", // Indigo
    "#3B82F6", // Blue
    "#06B6D4", // Cyan
    "#10B981", // Emerald
    "#22C55E", // Green
    "#84CC16", // Lime
    "#EAB308", // Yellow
    "#F59E0B", // Amber
    "#F97316", // Orange
    "#EF4444", // Red
    "#EC4899", // Pink
    "#D946EF", // Fuchsia
    "#A855F7", // Purple
    "#8B5CF6", // Violet
    "#14B8A6", // Teal
    "#0EA5E9", // Sky
    "#64748B", // Slate
    "#78716C", // Stone
    "#A3A3A3", // Neutral
    "#4ADE80"  // Light Green
];

function DashboardScreen({ products, sales, summary,categories,activityLogs,stockChartRef, topSellingProducts, onProductSelect }) {
  const cards = [
    { label: "Today's revenue", value: currency(summary.todayRevenue),icon: Wallet, accent: "text-blue-600" },
    { label: "Today's profit", value: currency(summary.todayProfit),icon: TrendingUp, accent: "text-emerald-600" },
    { label: "Sales today", value: summary.todaySalesCount, icon: ShoppingCart, accent: "text-slate-900" },
    { label: "Products", value: summary.productCount, icon: Package, accent: "text-slate-900" },
    { label: "Suppliers", value: summary.supplierCount,  icon: Truck, accent: "text-slate-600" },
  ];

  const categoryCounts = (categories ?? [])
      .map(category => ({
          name: category.name,
          count: (products ?? []).filter(
              product => product.categoryId === category.id
          ).length
      }))
      .sort((a, b) => b.count - a.count);
      
  const backgroundColor = categoryCounts.map(
      (_, index) => chartColors[index % chartColors.length]
  );

  const categoryChartData = {
    labels: categoryCounts.map((c) => c.name),
    datasets: [
      {
        data: categoryCounts.map((c) => c.count),
        backgroundColor,
        borderWidth: 0,
        borderRadius: 10,
        borderSkipped: false
      }
    ]
  };

  const healthyCount = (products ?? []).filter(
      (p) => p.stock > p.reorderLevel
  ).length;

  const lowStockCount = (products ?? []).filter(
      (p) => p.stock > 0 && p.stock <= p.reorderLevel
  ).length;

  const outOfStockCount = (products ?? []).filter(
      (p) => p.stock === 0
  ).length;

  const stockChartData = {
      labels: ["Healthy", "Low Stock", "Out of Stock"],
      datasets: [
          {
              label: "Products",
              data: [
                  healthyCount,
                  lowStockCount,
                  outOfStockCount
              ],
              backgroundColor: [
                  "#30b383",
                  "#e6ae21",
                  "#ee6363"
              ],
              //borderRadius: 0
          }
      ]
  };
  const activityIcons = {
      LOGIN: "🔐",

      PRODUCT_CREATED: "📦",
      PRODUCT_UPDATED: "✏️",
      PRODUCT_DELETED: "🗑️",

      SUPPLIER_CREATED: "🏢",
      SUPPLIER_UPDATED: "✏️",
      SUPPLIER_DELETED: "🗑️",

      CATEGORY_CREATED: "📂",
      CATEGORY_UPDATED: "✏️",
      CATEGORY_DELETED: "🗑️",

      USER_CREATED: "👤",
      USER_UPDATED: "✏️",
      USER_DELETED: "🗑️",

      PURCHASE_ORDER_CREATED: "📄",
      PURCHASE_ORDER_RECEIVED: "📥",

      SALE_COMPLETED: "🛒"
  };

  const topProductsForChart = (topSellingProducts ?? []).slice(0, 5);
  const topSellingChartData = {
      labels: topProductsForChart.map((product, index) => {
          const rank = ["🥇", "🥈", "🥉"][index] || `#${index + 1}`;
          return `${rank} ${product.name}`;
      }),
      datasets: [
          {
              label: "Units Sold",
              data: topProductsForChart.map((product) => Number(product.unitsSold || 0)),
              backgroundColor: topProductsForChart.map((product) => {
                  const stock = Number(product.stock || 0);
                  const reorderLevel = Number(product.reorderLevel || 0);

                  if (stock === 0) {
                      return "#EF4444";
                  }

                  if (stock <= reorderLevel) {
                      return "#F97316";
                  }

                  return "#10B981";
              }),
              borderRadius: 8,
              borderSkipped: false
          }
      ]
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="card p-3" key={card.label}>
              <div className="flex items-center justify-between">
                <Icon className={`h-15 w-15 ${card.accent}`} />
                <div className="flex-1 justify-center text-center">
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className={`mt-3 text-3xl font-semibold tracking-tight ${card.accent}`}>{card.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Inventory by Category */}
          <div
              className="rounded-3xl p-6"
              style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-soft)"
              }}
          >
              <h3
                  className="mb-4 text-lg font-semibold"
                  style={{ color: "var(--text-strong)" }}
              >
                  Inventory by Category
              </h3>

              <div className="h-64">
                <Bar
                    data={categoryChartData}
                    options={{
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: "#CBD5E1"
                                },
                                grid: {
                                    display: false
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: "#CBD5E1",
                                    precision: 0
                                },
                                grid: {
                                    color: "rgba(255,255,255,0.08)"
                                }
                            }
                        }
                    }}
                />
              </div>
          </div>

          {/* Stock Status */}
          <div
              className="rounded-3xl p-6"
              style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-soft)"
              }}
          >
              <h3
                  className="mb-4 text-lg font-semibold"
                  style={{ color: "var(--text-strong)" }}
              >
                  Stock Status
              </h3>

              <div className="h-64">
                <Doughnut
                    data={stockChartData}
                    options={{
                        maintainAspectRatio: false,
                        cutout: "0%",
                        onClick: (event, elements) => {
                            if (!elements.length) return;

                            const index = elements[0].index;
                            const label = stockChartData.labels[index];

                            if (
                                label === "Low Stock" ||
                                label === "Out of Stock"
                            ) {
                                document
                                    .getElementById("low-stock-alerts")
                                    ?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start"
                                    });
                            }
                        },
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: {
                                    color: "#CBD5E1"
                                }
                            }
                        }
                    }}
                />
              </div>
          </div>

          {/* Top Selling Products */}
          <div
              className="rounded-3xl p-6"
              style={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-soft)"
              }}
          >
              <h3
                  className="mb-4 text-lg font-semibold"
                  style={{ color: "var(--text-strong)" }}
              >
                  Top Selling Products
              </h3>

              {topProductsForChart.length ? (
                <div className="h-64">
                  <Bar
                    data={topSellingChartData}
                    options={{
                      indexAxis: "y",
                      maintainAspectRatio: false,
                      onClick: (_event, elements) => {
                        if (!elements.length) {
                          return;
                        }

                        const product = topProductsForChart[elements[0].index];
                        if (product) {
                          onProductSelect?.(product);
                        }
                      },
                      plugins: {
                        legend: {
                          display: false
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              const product = topProductsForChart[context.dataIndex];
                              const stock = Number(product?.stock || 0);
                              const reorderLevel = Number(product?.reorderLevel || 0);
                              const status = stock === 0 ? "Out of Stock" : stock <= reorderLevel ? "Low Stock" : "Healthy";
                              return [
                                `Sold: ${Number(product?.unitsSold || 0)}`,
                                `Stock: ${stock}`,
                                currency(product?.price),
                                status
                              ];
                            }
                          }
                        }
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                          ticks: {
                            color: "#CBD5E1",
                            precision: 0
                          },
                          grid: {
                            color: "rgba(255,255,255,0.08)"
                          }
                        },
                        y: {
                          ticks: {
                            color: "#CBD5E1",
                            callback: function(value) {
                              const label = this.getLabelForValue(value);
                              return label.length > 28 ? `${label.slice(0, 28)}...` : label;
                            }
                          },
                          grid: {
                            display: false
                          }
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>No sales available.</p>
              )}
          </div>

      </div>
      {/* Recent Activity Logs */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div
          className="rounded-3xl p-6 mt-6"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-soft)"
          }}
        >
          <h3
            className="text-lg font-semibold mb-5"
            style={{ color: "var(--text-strong)" }}
          >
            Recent Activity
          </h3>

          <div className="max-h-[640px] space-y-3 overflow-y-auto pr-1">
            {(activityLogs ?? []).slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-xl px-3 py-2 transition-all hover:bg-white/5"
              >
                <div
                  className="w-50 text-xs shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  {new Date(log.createdAt).toLocaleString()}
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <div className="text-base">
                    {activityIcons[log.action] ?? "📌"}
                  </div>
                  <div>
                    <div
                      className="text-sm font-medium leading-5"
                      style={{ color: "var(--text-strong)" }}
                    >
                      {log.description}
                    </div>
                    <div
                      className="text-xs uppercase tracking-wider"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {log.action.replaceAll("_", " ")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-3xl p-6 mt-6"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-soft)"
          }}
        >
          <h3
            className="text-lg font-semibold mb-5"
            style={{ color: "var(--text-strong)" }}
          >
            Low stock alerts
          </h3>

          {summary.lowStockItems.length ? (
            <div className="max-h-[640px] space-y-3 overflow-y-auto pr-1">
              {summary.lowStockItems.map((product) => (
                <div
                  className="flex items-center justify-between rounded-2xl border px-4 py-3"
                  key={product.id}
                  style={{
                    borderColor: "rgba(var(--warning-rgb), 0.26)",
                    background: "rgba(var(--warning-rgb), 0.1)"
                  }}
                >
                  <div>
                    <p className="font-medium" style={{ color: "var(--text-strong)" }}>
                      {product.name}
                    </p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                      Reorder at {product.reorderLevel}
                    </p>
                  </div>
                  <StatusPill tone={Number(product.stock) === 0 ? "danger" : "warning"}>
                    {product.stock} left
                  </StatusPill>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description="All tracked products are above their reorder levels."
              title="No urgent stock alerts"
            />
          )}
        </div>
      </div>


      <div className="grid gap-6 xl:grid-cols-1">
        

        <SectionCard title="Recent sales" subtitle="Most recent completed transactions.">
          <DataTable
            columns={[
              { key: "createdAt", label: "Time", render: (row) => formatDateTime(row.createdAt) },
              {key: "cashier", label: "Cashier", render: (row) => row.cashier?.name || "N/A"},
              { key: "id", label: "Sale" },
              { key: "items", label: "Items", render: (row) => row.items.reduce((sum, item) => sum + item.quantity, 0) },
              { key: "total", label: "Total", render: (row) => currency(row.total) },

            ]}
            rows={sales}
          />
        </SectionCard>
      </div>

      <SectionCard title="Inventory snapshot" subtitle="Readable overview of current stock and current stock value.">
        <DataTable
          columns={[
            { key: "name", label: "Product" },
            { key: "stock", label: "Stock" },
            {
              key: "value",
              label: "Value",
              render: (row) => currency(Number(row.stock) * Number(row.costPrice || 0))
            }
          ]}
          rows={products}
        />
      </SectionCard>
    </section>
  );
}

function InventoryScreen({ busy, 
  categories, 
  suppliers, 
  onAddCategory, 
  onEditProduct, 
  onDeleteProduct, 
  setDeleteDialog, 
  onNewProduct, 
  onSort, 
  products, 
  focusedProductId,
  sortConfig,
  onDeleteCategory,    
  editingCategoryId,
  editingCategoryName,
  setEditingCategoryId,
  setEditingCategoryName,
  saveCategory,  }) 
  {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  useEffect(() => {
    if (!focusedProductId) {
      return;
    }

    const product = products.find((entry) => entry.id === focusedProductId);
    if (product) {
      setSearch(product.name);
      setCategoryFilter("all");
      setSupplierFilter("all");
      setStockFilter("all");
    }
  }, [focusedProductId, products]);

  const filteredProducts = products.filter((product) => {
    const searchText = search.trim().toLowerCase();

    // Search
    if (
      searchText &&
      !(
        product.name?.toLowerCase().includes(searchText) ||
        product.barcode?.toLowerCase().includes(searchText) ||
        product.sku?.toLowerCase().includes(searchText)
      )
    ) {
      return false;
    }

    // Category
    if (
      categoryFilter !== "all" &&
      String(product.categoryId) !== categoryFilter
    ) {
      return false;
    }

    // Supplier
    if (
      supplierFilter !== "all" &&
      String(product.supplierId) !== supplierFilter
    ) {
      return false;
    }

    // Stock Status
    switch (stockFilter) {
      case "healthy":
        return product.stock > product.reorderLevel;

      case "low":
        return (
          product.stock > 0 &&
          product.stock <= product.reorderLevel
        );

      case "out":
        return product.stock === 0;

      default:
        return true;
    }
  });
  return (
    <section className="space-y-6">
      <section
        className="rounded-3xl border p-5 shadow-sm"
        style={{
            background: "var(--surface-2)",
            borderColor: "var(--border-soft)"
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">

                {/* Search */}

                <div>
                  {/*
                      <SearchIcon
                        className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
                        style={{ color: "var(--text-faint)" }}
                      />
                  */}
                  <label
                      className="mb-2 block text-sm font-semibold"
                      style={{ color: "var(--text-soft)" }}
                  >
                      Search 
                  </label>

                  

                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Name, Barcode or SKU..."
                        //className="w-full rounded-xl border px-3 py-2"
                        className="h-10 w-full rounded-xl border pl-10 pr-4"
                    />
                </div>

                {/* Category */}

                <div>
                    <label
                      className="mb-2 block text-sm font-semibold"
                      style={{ color: "var(--text-soft)" }}
                  >
                        Category
                    </label>

                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2"
                        style={{
                            background: "var(--surface-3)",
                            color: "var(--text-strong)",
                            borderColor: "var(--border-soft)"
                        }}
                    >
                        <option value="all">All Categories</option>

                        {categories.map(category => (
                            <option
                                key={category.id}
                                value={category.id}
                            >
                                {category.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Supplier */}

                <div>
                    <label
                      className="mb-2 block text-sm font-semibold"
                      style={{ color: "var(--text-soft)" }}
                  >
                        Supplier
                    </label>

                    <select
                        value={supplierFilter}
                        onChange={(e) => setSupplierFilter(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2"
                        style={{
                            background: "var(--surface-3)",
                            color: "var(--text-strong)",
                            borderColor: "var(--border-soft)"
                        }}
                    >
                        <option value="all">
                            All Suppliers
                        </option>

                        {suppliers.map(supplier => (
                            <option
                                key={supplier.id}
                                value={supplier.id}
                            >
                                {supplier.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Stock */}

                <div>
                    <label
                        className="mb-2 block text-sm font-semibold"
                        style={{ color: "var(--text-soft)" }}
                    >
                        Stock
                    </label>

                    <select
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2"
                        style={{
                            background: "var(--surface-3)",
                            color: "var(--text-strong)",
                            borderColor: "var(--border-soft)"
                        }}
                    >
                        <option value="all">All Stock</option>
                        <option value="healthy">Healthy</option>
                        <option value="low">Low Stock</option>
                        <option value="out">Out of Stock</option>
                    </select>
                </div>

            </div>
            <button
                onClick={() => {
                    setSearch("");
                    setCategoryFilter("all");
                    setSupplierFilter("all");
                    setStockFilter("all");
                }}
                className="btn-secondary h-11"
            >
                Clear Filters
            </button>


        </div>
      </section>
      <div
          className="mb-3 flex items-center justify-between"
      >
          <p
              className="text-sm"
              style={{ color: "var(--text-faint)" }}
          >
              Showing <strong>{filteredProducts.length}</strong> of{" "}
              <strong>{products.length}</strong> products
          </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <SectionCard
          action={
            <button className="btn-primary" onClick={onNewProduct} type="button">
              Add product
            </button>
          }
          //subtitle="Clean table layout with faster scanning and easier editing."
          title="Products"
        >
          <DataTable
            columns={[
              { key: "name", label: "Product", sortable: true },
              { key: "barcode", label: "Barcode", render: (row) => row.barcode || "-" },
              {/* key: "sku", label: "SKU", render: (row) => row.sku || "-" */},
              {
                key: "supplier",
                label: "Supplier",
                render: (product) =>
                  suppliers.find((s) => s.id === product.supplierId)?.name || "-"
              },
              { key: "price", label: "Price", sortable: true, render: (row) => currency(row.price) },
              { key: "stock", label: "Stock", sortable: true },
              {
                key: "status",
                label: "Status",
                render: (row) =>
                  Number(row.stock) === 0 ? (
                    <StatusPill tone="danger">Out of stock</StatusPill>
                  ) : Number(row.stock) <= Number(row.reorderLevel) ? (
                    <StatusPill tone="warning">Low stock</StatusPill>
                  ) : (
                    <StatusPill tone="success">Healthy</StatusPill>
                  ),
                  
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex items-center justify-left gap-2">
                    <button
                      type="button"
                      title="Edit Product"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditProduct(row);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl
                                bg-sky-500/10 text-sky-500
                                transition-all duration-200
                                hover:scale-105
                                hover:bg-sky-500
                                hover:text-white"
                    >
                      <PencilIcon />
                    </button>

                    <button
                      type="button"
                      title="Delete Product"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDialog({
                            type: "product",
                            data: row
                        });
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl
                                bg-red-500/10 text-red-500
                                transition-all duration-200
                                hover:scale-105
                                hover:bg-red-500
                                hover:text-white"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )
              } 
            ]}
            onSort={(key) => onSort("products", key)}
            rowClassName={(row) => row.id === focusedProductId ? "ring-1 ring-emerald-400/60 bg-emerald-500/10" : ""}
            rows={filteredProducts}
            sortConfig={sortConfig}
          />
        </SectionCard>

        <SectionCard title="Categories">
          <InlineAdd
            busy={busy === "add-category"}
            onSubmit={onAddCategory}
            placeholder="Add category"
          />
          {/*}
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600"
                key={category.id}
              >
                {category.name}
              </span>
            ))}
          </div>
          */}
          <div className="mt-4 space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-2xl border p-4 transition hover:shadow-md"
                style={{
                  background: "var(--surface-3)",
                  borderColor: "var(--border-soft)"
                }}
              >
                <div>
                  {/*}
                  <h4
                    className="font-semibold"
                    style={{ color: "var(--text-strong)" }}
                  >
                    {category.name}
                  </h4>*/}
                  {editingCategoryId === category.id ? (
                    <input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        autoFocus
                        className="rounded-lg border px-3 py-1 text-sm"
                        style={{
                            background: "var(--surface-2)",
                            borderColor: "var(--border-soft)",
                            color: "var(--text-strong)"
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                saveCategory(category.id);
                            }

                            if (e.key === "Escape") {
                                setEditingCategoryId(null);
                                setEditingCategoryName("");
                            }
                        }}
                    />
                  ) : (
                      <h4>{category.name}</h4>
                  )}

                </div>
                <div className="flex gap-2">

                  {editingCategoryId === category.id ? (
                    <>
                      <button
                        type="button"
                        title="Save"
                        onClick={() => saveCategory(category.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl
                                  bg-green-500/10 text-green-500
                                  hover:bg-green-500 hover:text-white"
                      >
                        <CheckIcon />
                      </button>

                      <button
                        type="button"
                        title="Cancel"
                        onClick={() => {
                          setEditingCategoryId(null);
                          setEditingCategoryName("");
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-xl
                                  bg-gray-500/10 text-gray-500
                                  hover:bg-gray-500 hover:text-white"
                      >
                        <CloseIcon />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        title="Edit"
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setEditingCategoryName(category.name);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-xl
                                  bg-sky-500/10 text-sky-500
                                  hover:bg-sky-500 hover:text-white"
                      >
                        <PencilIcon />
                      </button>

                      <button
                        type="button"
                        title="Delete"
                        onClick={() =>
                          setDeleteDialog({
                            type: "category",
                            data: category
                          })
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl
                                  bg-red-500/10 text-red-500
                                  hover:bg-red-500 hover:text-white"
                      >
                        <TrashIcon />
                      </button>
                    </>
                  )}

                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </section>

    
  );
}

function SuppliersScreen({ onEditSupplier, onNewSupplier, suppliers, onDeleteSupplier,setDeleteDialog }) {
  return (
    <section className="space-y-6">
      <SectionCard
        action={
          <button className="btn-primary" onClick={onNewSupplier} type="button">
            Add supplier
          </button>
        }
        subtitle="Supplier records are shown as readable cards for faster contact lookup."
        title="Supplier Directory"
      >
        {suppliers.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {suppliers.map((supplier) => (
              <button
                className="card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                key={supplier.id}
                onClick={() => onEditSupplier(supplier)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">{supplier.name}</h3>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Supplier</span>
                  <button
                    type="button"
                    title="Delete Supplier"
                    className="flex h-9 w-9 items-center justify-center rounded-xl
                              bg-red-500/10 text-red-500 transition-all
                              hover:scale-105 hover:bg-red-500 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDialog({
                          type: "supplier",
                          data: supplier
                        });
                      }}

                  >
                    <TrashIcon />
                  </button>
                </div>
                <dl className="mt-4 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Contact</dt>
                    <dd>{supplier.contactPerson || "-"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Phone</dt>
                    <dd>{supplier.phone || "-"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-400">Email</dt>
                    <dd className="truncate">{supplier.email || "-"}</dd>
                  </div>
                </dl>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Create your first supplier to start replenishment workflows."
            title="No suppliers yet"
          />
        )}
      </SectionCard>
    </section>
  );
}

function OrdersScreen({ busyKey, form, onChange, onReceiveOrder, onSubmit, products, purchaseOrders, suppliers }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard subtitle="Create clean purchase orders with fewer clicks." title="Create Purchase Order">
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Supplier">
              <select
                className="input"
                onChange={(event) => onChange({ ...form, supplierId: event.target.value })}
                required
                value={form.supplierId}
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field helper="Optional internal note" label="Notes">
              <textarea
                className="input min-h-24"
                onChange={(event) => onChange({ ...form, notes: event.target.value })}
                rows="3"
                value={form.notes}
              />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Order lines</h3>
                <p className="text-sm text-slate-500">Select products, quantity, and latest supplier cost.</p>
              </div>
              <button
                className="btn-secondary"
                onClick={() => onChange({ ...form, items: [...form.items, { productId: "", quantity: 1, costPrice: 0 }] })}
                type="button"
              >
                Add line
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.6fr_0.7fr_0.8fr]" key={`po-item-${index}`}>
                  <select
                    className="input"
                    onChange={(event) => updatePurchaseOrderItem(onChange, form, index, "productId", event.target.value)}
                    value={item.productId}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    min="1"
                    onChange={(event) => updatePurchaseOrderItem(onChange, form, index, "quantity", event.target.value)}
                    type="number"
                    value={item.quantity}
                  />
                  <input
                    className="input"
                    min="0"
                    onChange={(event) => updatePurchaseOrderItem(onChange, form, index, "costPrice", event.target.value)}
                    type="number"
                    value={item.costPrice}
                  />
                </div>
              ))}
            </div>
          </div>

          <button className="btn-primary" disabled={busyKey === "create-order"} type="submit">
            {busyKey === "create-order" ? "Creating order..." : "Create purchase order"}
          </button>
        </form>
      </SectionCard>

      <SectionCard subtitle="Receive pending orders directly from the list." title="Order Tracking">
        {purchaseOrders.length ? (
          <div className="space-y-3">
            {purchaseOrders.map((order) => {
              const supplier = suppliers.find((entry) => entry.id === order.supplierId);
              const pending = order.status === "pending";
              return (
                <div className="card p-4" key={order.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{order.id}</p>
                      <p className="text-sm text-slate-500">{supplier?.name || "Unknown supplier"}</p>
                    </div>
                    <StatusPill tone={pending ? "warning" : "success"}>{order.status}</StatusPill>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                    <span>{order.items.length} line items</span>
                    <span>{formatDateTime(order.createdAt)}</span>
                  </div>
                  {pending ? (
                    <button
                      className="btn-primary mt-4 w-full"
                      disabled={busyKey === `receive-${order.id}`}
                      onClick={() => onReceiveOrder(order.id)}
                      type="button"
                    >
                      {busyKey === `receive-${order.id}` ? "Receiving..." : "Mark as received"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState description="Create your first purchase order to start tracking stock intake." title="No purchase orders yet" />
        )}
      </SectionCard>
    </section>
  );
}

function PosScreen({
  barcodeInputRef,
  busyKey,
  cart,
  onAddToCart,
  onBarcodeSubmit,
  onCheckout,
  onQuantityChange,
  posNotice,
  products,
  searchValue,
  setSearchValue,
  onExit
}) {
  const total = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);

  return (
    <section className="grid h-full min-h-0 gap-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-start">
      <div className="flex h-full flex-col gap-4 min-h-0">
        <SectionCard title="Scan or Search"> 
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <BarcodeIcon />
              </span>
              <input
                className="input h-14 pl-12 text-base"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onBarcodeSubmit();
                  }
                }}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Scan barcode or search by product name"
                ref={barcodeInputRef}
                value={searchValue}
              />
            </div>
            <button className="btn-secondary h-14 px-5" onClick={() => barcodeInputRef.current?.focus()} type="button">
              Focus barcode
            </button>
          </div>
          {posNotice ? (
            <div
              className={`mt-3 inline-flex rounded-2xl border px-4 py-2 text-sm font-medium transition ${posNotice.tone === "error" ? "border-red-300/45 bg-red-500/10 text-red-500" : "border-emerald-300/45 bg-emerald-500/10 text-emerald-500"
                }`}
            >
              {posNotice.text}
            </div>
          ) : null}
        </SectionCard>
        
        <SectionCard 
          className="h-50 flex-1 flex-col min-h-0"
          contentClassName=" overflow-y-auto pr-7 min-h-0 pt-1"
          title="Products"
        >
          <div >
            {products.length ? (
              <div className="grid gap-4 md:grid-cols-3 2xl:grid-cols-3">
                {products.map((product) => (

                  <button className="card rounded-2xl border border-slate-200 p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md" key={product.id} onClick={() => onAddToCart(product)} type="button">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.barcode || product.sku || "No code"}</p>
                      </div>

                      <StatusPill tone={Number(product.stock) <= Number(product.reorderLevel) ? "warning" : "neutral"}>
                        {product.stock}
                      </StatusPill>
                    </div>

                    <div className="mt-2 flex items-end justify-between">
                      <p className="text-lg font-semibold tracking-tight text-blue-600">{currency(product.price)}</p>
                    </div>
                  </button>
                  /* This is a large button
                  <button
                    className="card rounded-3xl border border-slate-200 p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                    key={product.id}
                    onClick={() => onAddToCart(product)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{product.barcode || product.sku || "No code"}</p>
                      </div>
                      <StatusPill tone={Number(product.stock) <= Number(product.reorderLevel) ? "warning" : "neutral"}>
                        {product.stock}
                      </StatusPill>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <p className="text-2xl font-semibold tracking-tight text-blue-600">{currency(product.price)}</p>
                    </div>
                  </button>
                  */
                ))}
              </div>
            ) : (
              <EmptyState
                description="Try another barcode, SKU, or product keyword."
                title="No matching products"
              />
            )}
          </div>
        </SectionCard>

        <div className="mt-auto rounded-[28px] border border-white/10 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-end justify-between gap-4 md:min-w-[280px]">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Total</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight">{currency(total)}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-3 py-2 text-right text-sm text-slate-300">
                <p>{cart.length} line items</p>
              </div>
            </div>
            <button
              className="btn-primary h-14 w-full bg-blue-500 text-base hover:bg-blue-400 md:w-72"
              disabled={!cart.length || busyKey === "create-sale"}
              onClick={onCheckout}
              type="button"
            >
              {busyKey === "create-sale" ? "Completing sale..." : "Checkout"}
            </button>
          </div>
        </div>
      </div>

      <SectionCard
        className="h-full min-h-0"
        contentClassName=" flex-1 overflow-y-auto pr-1"
        subtitle=""
        title="Current Bill"
      >
        <div className="space-y-3">
          {cart.length ? (
            cart.map((item) => (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={item.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">{currency(item.price)} each</p>
                  </div>
                  <p className="text-lg font-semibold text-slate-900">{currency(item.price * item.quantity)}</p>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button className="btn-secondary h-11 w-11 rounded-2xl px-0" onClick={() => onQuantityChange(item.id, -1)} type="button">
                    -
                  </button>
                  <div className="flex h-11 min-w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900">
                    {item.quantity}
                  </div>
                  <button className="btn-secondary h-11 w-11 rounded-2xl px-0" onClick={() => onQuantityChange(item.id, 1)} type="button">
                    +
                  </button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState description="Tap a product card or scan a barcode to start the sale." title="No items in the bill" />
          )}
        </div>
      </SectionCard>
      <div className="h-22" mt-auto></div>
    </section>
    
    
  );
}

function ReportsScreen({ boot }) {
  const data = summarizeLocal(boot).summary;
  const groupedSales = Object.entries(groupSalesByDay(boot.sales));

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard subtitle="Products with the highest movement." title="Fast-moving Items">
          {data.fastMoving.length ? (
            <div className="space-y-3">
              {data.fastMoving.map((item) => (
                <MetricRow key={item.id} label={item.name} value={`${item.sold} sold`} />
              ))}
            </div>
          ) : (
            <EmptyState description="Sales history will populate these rankings." title="No sales movement yet" />
          )}
        </SectionCard>
        <SectionCard subtitle="Products that need merchandising or stock review." title="Slow-moving Items">
          {data.slowMoving.length ? (
            <div className="space-y-3">
              {data.slowMoving.map((item) => (
                <MetricRow key={item.id} label={item.name} value={`${item.sold} sold`} />
              ))}
            </div>
          ) : (
            <EmptyState description="Sales history will populate these rankings." title="No sales movement yet" />
          )}
        </SectionCard>
      </div>

      <SectionCard subtitle="Readable daily view for revenue and transaction count." title="Sales Summary">
        <DataTable
          columns={[
            { key: "date", label: "Date", render: ([date]) => date },
            { key: "count", label: "Transactions", render: ([, value]) => value.count },
            { key: "total", label: "Revenue", render: ([, value]) => currency(value.total) }
          ]}
          rows={groupedSales}
        />
      </SectionCard>
    </section>
  );
}

function UsersScreen({ onEditUser, onNewUser, onSort, sortConfig, users, onDeleteUser,setDeleteDialog }) {
  return (
    <section className="space-y-6">
      <SectionCard
        action={
          <button className="btn-primary" onClick={onNewUser} type="button">
            Add user
          </button>
        }
        subtitle="Cleaner access control UI with editable role cards in one place."
        title="Team Members"
      >
        <DataTable
          columns={[
            { key: "name", label: "Name", sortable: true },
            { key: "username", label: "Username" },
            {
              key: "role",
              label: "Role",
              render: (row) => (
                <span className="capitalize text-slate-700">{row.role.replace("_", " ")}</span>
              )
            },
            {
              key: "active",
              label: "Status",
              render: (row) => (row.active ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="neutral">Disabled</StatusPill>)
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex items-center justify-left gap-2">
                    <button
                      type="button"
                      title="Edit Product"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditUser(row);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl
                                bg-sky-500/10 text-sky-500
                                transition-all duration-200
                                hover:scale-105
                                hover:bg-sky-500
                                hover:text-white"
                    >
                      <PencilIcon />
                    </button>

                    <button
                      type="button"
                      title="Delete User"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteDialog({
                            type: "user",
                            data: row
                        });
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl
                                bg-red-500/10 text-red-500
                                transition-all duration-200
                                hover:scale-105
                                hover:bg-red-500
                                hover:text-white"
                    >
                      <TrashIcon />
                    </button>
                </div>
              )
            }
          ]}
          //onRowClick={onEditUser}
          onSort={(key) => onSort("users", key)}
          rows={users}
          sortConfig={sortConfig}
        />
      </SectionCard>
    </section>
  );
}

function BackupScreen({ backupText, busyKey, onBackupTextChange, onExport, onRestore }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <SectionCard subtitle="Keep manual backup and restore exactly as before, but with a cleaner operator workflow." title="Backup and Restore">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Export creates a JSON snapshot. Restore uses the text payload currently pasted into the editor.
          </div>
          <button className="btn-primary w-full" disabled={busyKey === "export-backup"} onClick={onExport} type="button">
            {busyKey === "export-backup" ? "Exporting..." : "Export backup"}
          </button>
          <button className="btn-secondary w-full" disabled={busyKey === "restore-backup"} onClick={onRestore} type="button">
            {busyKey === "restore-backup" ? "Restoring..." : "Restore from JSON"}
          </button>
        </div>
      </SectionCard>

      <SectionCard subtitle="Paste or review the snapshot below." title="Backup Payload">
        <textarea
          className="input min-h-[520px] font-mono text-xs"
          onChange={(event) => onBackupTextChange(event.target.value)}
          value={backupText}
        />
      </SectionCard>
    </section>
  );
}

function ScreenScrollArea({ children }) {
  return <div className="h-full overflow-y-auto pr-1">{children}</div>;
}

function ProductForm({ busy, categories,suppliers, form, onChange, onSubmit }) {
  return (
    <form
      className="space-y-4"
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
        }
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Product name">
          <input className="input" onChange={(event) => onChange({ ...form, name: event.target.value })} required value={form.name} />
        </Field>
        <Field label="Category">
          <select className="input" onChange={(event) => onChange({ ...form, categoryId: event.target.value })} value={form.categoryId}>
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Supplier">
          <select
            className="input"
            value={form.supplierId}
            onChange={(e) =>
              onChange({
                ...form,
                supplierId: e.target.value
              })
            }
          >
            <option value="">Select supplier</option>

            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Barcode">
          <input className="input" onChange={(event) => onChange({ ...form, barcode: event.target.value })} value={form.barcode} />
        </Field>
        <Field label="SKU">
          <input className="input" onChange={(event) => onChange({ ...form, sku: event.target.value })} value={form.sku} />
        </Field>
        <Field label="Unit">
          <select
            className="input"
            value={form.unit}
            onChange={(e) =>
              onChange({
                ...form,
                unit: e.target.value
              })
            }
          >
            <option value="pcs">Pieces</option>
            <option value="box">Box</option>
            <option value="kg">Kilograms</option>
            <option value="g">Grams</option>
            <option value="ltr">Litres</option>
            <option value="ml">Millilitres</option>
            <option value="pack">Pack</option>
          </select>
        </Field>
        <Field label="Sell price">
          <input className="input" min="0" onChange={(event) => onChange({ ...form, price: event.target.value })} type="number" value={form.price} />
        </Field>
        <Field label="Cost price">
          <input className="input" min="0" onChange={(event) => onChange({ ...form, costPrice: event.target.value })} type="number" value={form.costPrice} />
        </Field>
        <Field label="Stock">
          <input className="input" min="0" onChange={(event) => onChange({ ...form, stock: event.target.value })} type="number" value={form.stock} />
        </Field>
        <Field label="Reorder level">
          <input className="input" min="0" onChange={(event) => onChange({ ...form, reorderLevel: event.target.value })} type="number" value={form.reorderLevel} />
        </Field>
      </div>
      <Field helper="Optional product note" label="Description">
        <textarea
          className="input min-h-28"
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          rows="4"
          value={form.description}
        />
      </Field>
      <button className="btn-primary w-full" disabled={busy} type="submit">
        {busy ? "Saving..." : form.id ? "Update product" : "Add product"}
      </button>
    </form>
  );
}

function SupplierForm({ busy, form, onChange, onSubmit }) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Supplier name">
          <input className="input" onChange={(event) => onChange({ ...form, name: event.target.value })} required value={form.name} />
        </Field>
        <Field label="Contact person">
          <input className="input" onChange={(event) => onChange({ ...form, contactPerson: event.target.value })} value={form.contactPerson} />
        </Field>
        <Field label="Phone">
          <input className="input" onChange={(event) => onChange({ ...form, phone: event.target.value })} value={form.phone} />
        </Field>
        <Field label="Email">
          <input className="input" onChange={(event) => onChange({ ...form, email: event.target.value })} value={form.email} />
        </Field>
      </div>
      <Field label="Address">
        <textarea className="input min-h-28" onChange={(event) => onChange({ ...form, address: event.target.value })} rows="4" value={form.address} />
      </Field>
      <button className="btn-primary w-full" disabled={busy} type="submit">
        {busy ? "Saving..." : form.id ? "Update supplier" : "Add supplier"}
      </button>
    </form>
  );
}

function UserForm({ busy, form, onChange, onSubmit }) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name">
          <input className="input" onChange={(event) => onChange({ ...form, name: event.target.value })} required value={form.name} />
        </Field>
        <Field label="Username">
          <input className="input" onChange={(event) => onChange({ ...form, username: event.target.value })} required value={form.username} />
        </Field>
        <Field label="Role">
          <select className="input" onChange={(event) => onChange({ ...form, role: event.target.value })} value={form.role}>
            <option value="admin">Admin</option>
            <option value="cashier">Cashier</option>
            <option value="stock_handler">Stock Handler</option>
          </select>
        </Field>
        <Field helper={form.id ? "Leave empty to keep the current password." : ""} label="Password">
          <input className="input" onChange={(event) => onChange({ ...form, password: event.target.value })} value={form.password} />
        </Field>
      </div>
      <button className="btn-primary w-full" disabled={busy} type="submit">
        {busy ? "Saving..." : form.id ? "Update user" : "Add user"}
      </button>
    </form>
  );
}

function SectionCard({ id, action, children, className = "", contentClassName = "", subtitle, title }) {
  return (
    <section id={id} className={`card glass-panel flex min-h-0 flex-col overflow-hidden p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="section-subtitle mt-1">{subtitle}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className={`min-h-0 ${contentClassName}`}>{children}</div>
    </section>
  );
}

function DataTable({ columns, onRowClick, onSort, rowClassName, rows, sortConfig }) {
  if (!rows.length) {
    return <EmptyState description="Once data exists, it will appear here in a cleaner grid." title="Nothing to show yet" />;
  }

  return (
    <div className="table-shell">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => {
                const sortable = Boolean(column.sortable && onSort);
                const active = sortConfig?.key === column.key;
                return (
                  <th key={column.key}>
                    {sortable ? (
                      <button
                        className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-800"
                        onClick={() => onSort(column.key)}
                        type="button"
                      >
                        <span>{column.label}</span>
                        <SortIcon active={active} direction={active ? sortConfig.direction : ""} />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                className={[onRowClick ? "cursor-pointer" : "", rowClassName?.(row) || ""].filter(Boolean).join(" ")}
                key={row.id || row.key || index}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : readValue(row, column.key)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EntityModal({ children, onClose, open, subtitle, title }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
      <div className="card glass-panel max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>{title}</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>{subtitle}</p>
          </div>
          <button className="btn-secondary px-3 py-2" onClick={onClose} type="button">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({
    title,
    message,
    onCancel,
    onConfirm
}) {
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">

            <div
                className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
                style={{
                    background: "var(--surface-2)",
                    borderColor: "var(--border-soft)"
                }}
            >
                <div className="flex justify-center mb-5">
                    <div
                        className="flex h-16 w-16 items-center justify-center rounded-full"
                        style={{
                            background: "rgba(239,68,68,.12)"
                        }}
                    >
                        <TrashIcon className="h-8 w-8 text-red-500" />
                    </div>
                </div>

                <h2
                    className="text-center text-2xl font-bold"
                    style={{ color: "var(--text-strong)" }}
                >
                    {title}
                </h2>

                <p
                    className="mt-3 text-center"
                    style={{ color: "var(--text-faint)" }}
                >
                    {message}
                </p>

                <div className="mt-8 flex gap-3">

                    <button
                        className="btn-secondary flex-1"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>

                    <button
                        className="flex-1 rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700"
                        onClick={onConfirm}
                    >
                        Delete
                    </button>

                </div>
            </div>

        </div>
    );
}


function InlineAdd({ busy, onSubmit, placeholder }) {
  const [value, setValue] = useState("");

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
        setValue("");
      }}
    >
      <input className="input" placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} />
      <button className="btn-secondary whitespace-nowrap" disabled={busy} type="submit">
        {busy ? "Adding..." : "Add"}
      </button>
    </form>
  );
}

function Field({ children, helper, label }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {helper ? <span className="mt-1 block text-xs text-slate-400">{helper}</span> : null}
    </label>
  );
}

function Alert({ children, tone }) {
  const classes =
    tone === "error"
      ? "border-red-300/45 bg-red-500/10 text-red-500"
      : "border-emerald-300/45 bg-emerald-500/10 text-emerald-500";

  return <div className={`inline-flex rounded-xl border px-3 py-2 text-sm font-medium ${classes}`}>{children}</div>;
}

function StatusPill({ children, tone }) {
  const palette = {
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-300/30",
    warning: "bg-orange-500/10 text-orange-500 border-orange-300/30",
    neutral: "border text-[var(--text-soft)]",
    danger: "bg-red-500/10 text-red-500 border-red-300/30"
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${palette[tone]}`}
      style={tone === "neutral" ? { background: "rgba(var(--accent-rgb), 0.08)", borderColor: "rgba(var(--accent-rgb), 0.18)" } : undefined}
    >
      {children}
    </span>
  );
}

function EmptyState({ description, title }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-[26px] border border-dashed px-6 py-10 text-center" style={{ borderColor: "var(--border-strong)", background: "rgba(var(--accent-rgb), 0.04)" }}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>
        <BoxIcon />
      </div>
      <h4 className="text-base font-semibold" style={{ color: "var(--text-strong)" }}>{title}</h4>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-faint)" }}>{description}</p>
    </div>
  );
}

function LoadingBanner({ label }) {
  return (
    <div className="card flex items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={{ borderColor: "rgba(var(--accent-rgb), 0.22)", background: "rgba(var(--accent-rgb), 0.08)", color: "var(--accent-700)" }}>
      <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: "var(--accent-500)" }} />
      <span>{label}</span>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border-soft)", background: "var(--surface-3)" }}>
      <span className="font-medium" style={{ color: "var(--text-strong)" }}>{label}</span>
      <span className="text-sm" style={{ color: "var(--text-faint)" }}>{value}</span>
    </div>
  );
}

function ThemeMenu({ accentTheme, modeThemes, onAccentThemeChange, onModeChange, themeMode }) {
  return (
    <div className="absolute right-0 top-14 z-30 w-80 rounded-[28px] border p-4 shadow-2xl backdrop-blur-xl" style={{ background: "linear-gradient(180deg, var(--surface-2), var(--surface-1))", borderColor: "var(--border-soft)" }}>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-faint)" }}>Appearance</p>
          <div className="mt-3 grid gap-2">
            {modeThemes.map((mode) => (
              <button
                key={mode.id}
                className="flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition"
                onClick={() => onModeChange(mode.id)}
                style={{
                  background: themeMode === mode.id ? "rgba(var(--accent-rgb), 0.1)" : "var(--surface-3)",
                  borderColor: themeMode === mode.id ? "rgba(var(--accent-rgb), 0.26)" : "var(--border-soft)",
                  color: "var(--text-strong)"
                }}
                type="button"
              >
                <span>{mode.label}</span>
                {themeMode === mode.id ? <CheckIcon /> : null}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-faint)" }}>Accent theme</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {accentThemes.map((theme) => (
              <button
                key={theme.id}
                className="flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-xs font-medium transition"
                onClick={() => onAccentThemeChange(theme.id)}
                style={{
                  background: accentTheme === theme.id ? "rgba(var(--accent-rgb), 0.08)" : "var(--surface-3)",
                  borderColor: accentTheme === theme.id ? "rgba(var(--accent-rgb), 0.26)" : "var(--border-soft)",
                  color: "var(--text-soft)"
                }}
                type="button"
              >
                <span className="h-5 w-5 rounded-full" style={{ background: accentSwatchColor(theme.id) }} />
                <span>{theme.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToastViewport({ toasts }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto rounded-[24px] border px-4 py-3 shadow-2xl backdrop-blur-xl"
          style={{
            background: "linear-gradient(180deg, var(--surface-2), var(--surface-1))",
            borderColor: toast.tone === "error" ? "rgba(var(--danger-rgb), 0.28)" : "rgba(var(--accent-rgb), 0.24)"
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 h-2.5 w-2.5 rounded-full"
              style={{ background: toast.tone === "error" ? "rgb(var(--danger-rgb))" : "var(--accent-500)" }}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                {toast.tone === "error" ? "Action failed" : "Done"}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-soft)" }}>{toast.text}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDateTime(value) {
  return new Date(value).toLocaleString();
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

function syncTopSellingProducts(topSellingProducts = [], products = []) {
  const productMap = new Map(products.map((product) => [product.id, product]));

  return topSellingProducts
    .filter((product) => productMap.has(product.id))
    .map((product) => {
      const current = productMap.get(product.id);
      return {
        ...product,
        stock: current.stock,
        price: current.price,
        reorderLevel: current.reorderLevel
      };
    });
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
      .map((item) => (item.id === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
      .filter((item) => item.quantity > 0)
  );
}

function updatePurchaseOrderItem(setForm, form, index, field, value) {
  const items = form.items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, [field]: value } : item
  );
  setForm({ ...form, items });
}

function sortRows(rows, config) {
  const data = [...rows];
  if (!config?.key) {
    return data;
  }

  data.sort((left, right) => {
    const a = readValue(left, config.key);
    const b = readValue(right, config.key);

    if (typeof a === "number" && typeof b === "number") {
      return config.direction === "asc" ? a - b : b - a;
    }

    const result = String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true, sensitivity: "base" });
    return config.direction === "asc" ? result : -result;
  });

  return data;
}

function readValue(row, key) {
  if (Array.isArray(row)) {
    if (key === "date") {
      return row[0];
    }
    if (key === "count") {
      return row[1]?.count;
    }
    if (key === "total") {
      return row[1]?.total;
    }
  }

  return row?.[key];
}

function accentSwatchColor(themeId) {
  const colors = {
    blue: "#2563eb",
    emerald: "#10b981",
    purple: "#8b5cf6",
    orange: "#f97316",
    rose: "#f43f5e"
  };

  return colors[themeId] || colors.blue;
}

function getSearchConfig(tabId) {
  const configs = {
    dashboard: { visible: false, placeholder: "" },
    pos: { visible: true, placeholder: "Search products, barcode, or SKU" },
    inventory: { visible: true, placeholder: "Search products, barcode, or SKU" },
    suppliers: { visible: true, placeholder: "Search suppliers, contacts, phone, or email" },
    orders: { visible: true, placeholder: "Search order ID, supplier, status, or notes" },
    users: { visible: true, placeholder: "Search users, usernames, or roles" },
    reports: { visible: false, placeholder: "" },
    backup: { visible: false, placeholder: "" }
  };

  return configs[tabId] || { visible: false, placeholder: "" };
}

function iconPath(path) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {path}
    </svg>
  );
}

function StoreIcon() {
  return iconPath(
    <>
      <path d="M4 10.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8.5" />
      <path d="M3 8.5 4.8 4h14.4L21 8.5A2.5 2.5 0 0 1 18.5 11H18a3 3 0 0 1-3-2 3 3 0 0 1-6 0 3 3 0 0 1-3 2h-.5A2.5 2.5 0 0 1 3 8.5Z" />
    </>
  );
}

function HomeIcon() {
  return iconPath(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />);
}

function CartIcon() {
  return iconPath(
    <>
      <path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H7" />
      <path d="M9 20a1 1 0 1 0 0 .01" />
      <path d="M18 20a1 1 0 1 0 0 .01" />
    </>
  );
}

function BoxIcon() {
  return iconPath(
    <>
      <path d="m12 2 8 4.5v11L12 22 4 17.5v-11Z" />
      <path d="M12 22V11.5" />
      <path d="M20 6.5 12 11 4 6.5" />
    </>
  );
}

function PencilIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function TrashIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function TruckIcon() {
  return iconPath(
    <>
      <path d="M10 17H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h10v12" />
      <path d="M15 8h3l3 3v5a1 1 0 0 1-1 1h-1" />
      <path d="M8 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path d="M17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    </>
  );
}

function ClipboardIcon() {
  return iconPath(
    <>
      <path d="M9 4h6" />
      <path d="M10 2h4a1 1 0 0 1 1 1v1h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V3a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
      <path d="M9 8h6" />
    </>
  );
}

function ChartIcon() {
  return iconPath(
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20v-11" />
    </>
  );
}

function UsersIcon() {
  return iconPath(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <path d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  );
}

function ShieldIcon() {
  return iconPath(
    <>
      <path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  );
}

function SearchIcon() {
  return iconPath(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  );
}

function MenuIcon() {
  return iconPath(
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  );
}

function CloseIcon() {
  return iconPath(
    <>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </>
  );
}

function BarcodeIcon() {
  return iconPath(
    <>
      <path d="M4 5v14" />
      <path d="M8 5v14" />
      <path d="M11 5v14" />
      <path d="M15 5v14" />
      <path d="M18 5v14" />
      <path d="M20 5v14" />
    </>
  );
}

function SortIcon({ active, direction }) {
  return (
    <span className={`inline-flex items-center ${active ? "text-slate-700" : "text-slate-400"}`}>
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        {direction === "desc" ? <path d="m7 10 5 5 5-5" /> : <path d="m7 14 5-5 5 5" />}
      </svg>
    </span>
  );
}

function PaletteIcon() {
  return iconPath(
    <>
      <path d="M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-1.1c-1 0-1.9.8-1.9 1.8 0 .5.2 1 .5 1.3.4.4.5.9.5 1.4 0 1.3-1.2 2.5-2.7 2.5H12Z" />
      <path d="M7.5 11a1 1 0 1 0 0 .01" />
      <path d="M12 7a1 1 0 1 0 0 .01" />
      <path d="M16.5 11a1 1 0 1 0 0 .01" />
    </>
  );
}

function ChevronLeftIcon() {
  return iconPath(<path d="m15 18-6-6 6-6" />);
}

function ChevronRightIcon() {
  return iconPath(<path d="m9 18 6-6-6-6" />);
}

function CheckIcon() {
  return iconPath(<path d="m5 12 4 4 10-10" />);
}
