let store;

if (process.env.DB_PROVIDER === "mysql") {
    store = await import("./store.js");
} else {
    store = await import("./store_pg.js");
}

export const {
    ensureStore,
    readStore,
    writeStore,
    withStore,
    generateId,
    closeStore
} = store;

export const getProducts = store.getProducts;
export const createProduct = store.createProduct;
export const updateProduct = store.updateProduct;
export const deleteProduct = store.deleteProduct;
export const getSuppliers = store.getSuppliers;
export const createSupplier = store.createSupplier;
export const updateSupplier = store.updateSupplier;
export const getSupplier = store.getSupplier;
export const supplierInUse = store.supplierInUse;
export const deleteSupplier = store.deleteSupplier;
export const getUsers = store.getUsers;
export const getUserByUsername = store.getUserByUsername;
export const getUserById = store.getUserById;
export const createUser = store.createUser;
export const updateUser = store.updateUser;
export const deleteUser = store.deleteUser;
export const getCategories = store.getCategories;
export const createCategory = store.createCategory;
export const updateCategory = store.updateCategory;
export const getCategory = store.getCategory;
export const categoryInUse = store.categoryInUse;
export const deleteCategory = store.deleteCategory;
export const getPurchaseOrders = store.getPurchaseOrders;
export const createPurchaseOrder = store.createPurchaseOrder;
export const receivePurchaseOrder = store.receivePurchaseOrder;
export const getSales = store.getSales;
export const createSale = store.createSale;
export const exportBackup = store.exportBackup;
export const restoreBackup = store.restoreBackup;
export const logActivity = store.logActivity;
export const getActivityLogs = store.getActivityLogs;
