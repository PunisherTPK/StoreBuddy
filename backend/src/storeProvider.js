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
export const getSuppliers = store.getSuppliers;
export const deleteSupplier = store.deleteSupplier;
export const getUsers = store.getUsers;
export const deleteUser = store.deleteUser;