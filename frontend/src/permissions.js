export const ROLES = {
  ADMIN: "admin",
  CASHIER: "cashier",
  STOCK_HANDLER: "stock_handler"
};

export const PERMISSIONS = {
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_PRODUCTS: "view_products",
  VIEW_CATEGORIES: "view_categories",
  VIEW_SUPPLIERS: "view_suppliers",
  VIEW_PURCHASE_ORDERS: "view_purchase_orders",
  USE_POS: "use_pos",
  VIEW_REPORTS: "view_reports",
  MANAGE_USERS: "manage_users",
  MANAGE_SETTINGS: "manage_settings",
  VIEW_ACTIVITY_LOGS: "view_activity_logs",
  VIEW_REVENUE: "view_revenue",
  VIEW_PROFIT: "view_profit",
  VIEW_COST_PRICES: "view_cost_prices",
  VIEW_SUPPLIER_COSTS: "view_supplier_costs",
  VIEW_MONTHLY_REPORTS: "view_monthly_reports",
  VIEW_FINANCIAL_REPORTS: "view_financial_reports",
  VIEW_CASHIER_PERFORMANCE: "view_cashier_performance",
  VIEW_BUSINESS_INSIGHTS: "view_business_insights",
  MANAGE_INVENTORY: "manage_inventory"
};

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.CASHIER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.USE_POS,
    PERMISSIONS.VIEW_REVENUE
  ],
  [ROLES.STOCK_HANDLER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_CATEGORIES,
    PERMISSIONS.VIEW_SUPPLIERS,
    PERMISSIONS.VIEW_PURCHASE_ORDERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_INVENTORY
  ]
};

export const MODULE_PERMISSIONS = {
  dashboard: PERMISSIONS.VIEW_DASHBOARD,
  inventory: PERMISSIONS.VIEW_PRODUCTS,
  suppliers: PERMISSIONS.VIEW_SUPPLIERS,
  orders: PERMISSIONS.VIEW_PURCHASE_ORDERS,
  pos: PERMISSIONS.USE_POS,
  reports: PERMISSIONS.VIEW_REPORTS,
  users: PERMISSIONS.MANAGE_USERS,
  backup: PERMISSIONS.MANAGE_SETTINGS
};

export const REPORT_PERMISSIONS = {
  overview: PERMISSIONS.VIEW_FINANCIAL_REPORTS,
  sales: PERMISSIONS.VIEW_FINANCIAL_REPORTS,
  profit: PERMISSIONS.VIEW_PROFIT,
  stock: PERMISSIONS.VIEW_REPORTS,
  inventory: PERMISSIONS.VIEW_REPORTS,
  suppliers: PERMISSIONS.VIEW_REPORTS,
  purchases: PERMISSIONS.VIEW_REPORTS,
  products: PERMISSIONS.VIEW_REPORTS,
  categories: PERMISSIONS.VIEW_REPORTS,
  cashiers: PERMISSIONS.VIEW_CASHIER_PERFORMANCE,
  monthly: PERMISSIONS.VIEW_MONTHLY_REPORTS,
  insights: PERMISSIONS.VIEW_BUSINESS_INSIGHTS
};

export function hasPermission(userOrRole, permission) {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  return Boolean(role && ROLE_PERMISSIONS[role]?.includes(permission));
}

export function canAccessModule(userOrRole, moduleId) {
  const permission = MODULE_PERMISSIONS[moduleId];
  return Boolean(permission && hasPermission(userOrRole, permission));
}

export function canAccessReport(userOrRole, reportId) {
  const permission = REPORT_PERMISSIONS[reportId];
  return Boolean(permission && hasPermission(userOrRole, permission));
}

export function canViewFinancials(userOrRole) {
  return hasPermission(userOrRole, PERMISSIONS.VIEW_FINANCIAL_REPORTS);
}

export function canViewReports(userOrRole) {
  return hasPermission(userOrRole, PERMISSIONS.VIEW_REPORTS);
}

export function canViewProfit(userOrRole) {
  return hasPermission(userOrRole, PERMISSIONS.VIEW_PROFIT);
}

export function canViewRevenue(userOrRole) {
  return hasPermission(userOrRole, PERMISSIONS.VIEW_REVENUE);
}

export function canManageInventory(userOrRole) {
  return hasPermission(userOrRole, PERMISSIONS.MANAGE_INVENTORY);
}

export function canManageUsers(userOrRole) {
  return hasPermission(userOrRole, PERMISSIONS.MANAGE_USERS);
}

export function canUsePOS(userOrRole) {
  return hasPermission(userOrRole, PERMISSIONS.USE_POS);
}
