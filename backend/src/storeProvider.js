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