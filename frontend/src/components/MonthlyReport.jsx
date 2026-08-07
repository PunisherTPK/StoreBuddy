import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import { FEATURES } from "../features";

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

/* ============================================================
   CONSTANTS + SMALL HELPERS
============================================================ */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRID_LINE = "rgba(255,255,255,0.08)";
const AXIS_TEXT = "#CBD5E1";

const CHART_PALETTE = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#64748B"
];

function currency(value) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function compactNumber(value) {
  return new Intl.NumberFormat("en-LK", { maximumFractionDigits: 1 }).format(Number(value || 0));
}

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function isSameMonth(date, year, month) {
  return date.getFullYear() === year && date.getMonth() === month;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function pctChange(curr, prev) {
  if (!prev) {
    return curr > 0 ? 100 : 0;
  }
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function formatPct(value, digits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ============================================================
   CORE AGGREGATION — everything for a single month lives here
============================================================ */

function computeMonthMetrics({ sales, purchaseOrders, products, year, month }) {
  const inMonth = (value) => isSameMonth(toDate(value), year, month);
  const monthSales = sales.filter((sale) => inMonth(sale.createdAt));
  const monthPOs = purchaseOrders.filter((po) => inMonth(po.createdAt));
  const costMap = new Map(products.map((product) => [product.id, Number(product.costPrice || 0)]));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const numDays = daysInMonth(year, month);

  let totalRevenue = 0;
  let cogs = 0;
  let unitsSold = 0;
  const saleTotals = [];
  const dailyRevenue = Array(numDays).fill(0);
  const dailyCogs = Array(numDays).fill(0);
  const dowRevenue = Array(7).fill(0);
  const hourRevenue = Array(24).fill(0);
  const cashierMap = new Map();
  const productSaleMap = new Map();
  const categorySaleMap = new Map();

  for (const sale of monthSales) {
    const total = Number(sale.total || 0);
    totalRevenue += total;
    saleTotals.push(total);

    const date = toDate(sale.createdAt);
    const dayIdx = date.getDate() - 1;
    dailyRevenue[dayIdx] += total;
    dowRevenue[date.getDay()] += total;
    hourRevenue[date.getHours()] += total;

    let saleCogs = 0;
    let saleProfit = 0;
    let saleUnits = 0;

    for (const item of sale.items || []) {
      const quantity = Number(item.quantity || 0);
      const cost = costMap.get(item.productId) || 0;
      const lineRevenue = Number(item.price || 0) * quantity;
      const lineCogs = cost * quantity;

      saleCogs += lineCogs;
      saleProfit += lineRevenue - lineCogs;
      saleUnits += quantity;
      unitsSold += quantity;

      const product = productMap.get(item.productId);

      const prodEntry = productSaleMap.get(item.productId) || {
        id: item.productId,
        name: item.name || product?.name || "Unknown product",
        unitsSold: 0,
        revenue: 0,
        profit: 0
      };
      prodEntry.unitsSold += quantity;
      prodEntry.revenue += lineRevenue;
      prodEntry.profit += lineRevenue - lineCogs;
      productSaleMap.set(item.productId, prodEntry);

      const categoryId = product?.categoryId || "uncategorized";
      const catEntry = categorySaleMap.get(categoryId) || {
        id: categoryId,
        revenue: 0,
        profit: 0,
        unitsSold: 0
      };
      catEntry.revenue += lineRevenue;
      catEntry.profit += lineRevenue - lineCogs;
      catEntry.unitsSold += quantity;
      categorySaleMap.set(categoryId, catEntry);
    }

    cogs += saleCogs;
    dailyCogs[dayIdx] += saleCogs;

    const cashierEntry = cashierMap.get(sale.cashierId) || {
      cashierId: sale.cashierId,
      transactions: 0,
      revenue: 0,
      profit: 0,
      unitsSold: 0,
      largestSale: 0
    };
    cashierEntry.transactions += 1;
    cashierEntry.revenue += total;
    cashierEntry.profit += saleProfit;
    cashierEntry.unitsSold += saleUnits;
    cashierEntry.largestSale = Math.max(cashierEntry.largestSale, total);
    cashierMap.set(sale.cashierId, cashierEntry);
  }

  let purchaseCost = 0;
  const supplierMap = new Map();

  for (const po of monthPOs) {
    const poTotal = (po.items || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.costPrice || 0),
      0
    );
    purchaseCost += poTotal;

    const supplierEntry = supplierMap.get(po.supplierId) || {
      supplierId: po.supplierId,
      orders: 0,
      purchaseValue: 0
    };
    supplierEntry.orders += 1;
    supplierEntry.purchaseValue += poTotal;
    supplierMap.set(po.supplierId, supplierEntry);
  }

  const grossProfit = totalRevenue - cogs;
  const inventoryValue = products.reduce(
    (sum, product) => sum + Number(product.stock || 0) * Number(product.costPrice || 0),
    0
  );
  const lowStockCount = products.filter(
    (product) => Number(product.stock) > 0 && Number(product.stock) <= Number(product.reorderLevel)
  ).length;
  const outOfStockCount = products.filter((product) => Number(product.stock) === 0).length;
  const soldProductIds = new Set(productSaleMap.keys());
  const productsNotSold = products.filter((product) => !soldProductIds.has(product.id));

  return {
    monthSales,
    monthPOs,
    totalRevenue,
    cogs,
    grossProfit,
    netProfit: grossProfit,
    purchaseCost,
    inventoryValue,
    numberOfSales: monthSales.length,
    numberOfPOs: monthPOs.length,
    unitsSold,
    lowStockCount,
    outOfStockCount,
    productsNotSold,
    avgSale: monthSales.length ? totalRevenue / monthSales.length : 0,
    highestSale: saleTotals.length ? Math.max(...saleTotals) : 0,
    lowestSale: saleTotals.length ? Math.min(...saleTotals) : 0,
    profitMargin: totalRevenue ? (grossProfit / totalRevenue) * 100 : 0,
    avgDailyRevenue: totalRevenue / numDays,
    dailyRevenue,
    dailyCogs,
    dowRevenue,
    hourRevenue,
    cashierPerformance: [...cashierMap.values()],
    productPerformance: [...productSaleMap.values()],
    categoryPerformance: [...categorySaleMap.values()],
    supplierPerformance: [...supplierMap.values()],
    numDays
  };
}

/* ============================================================
   SMALL SHARED UI PRIMITIVES (self-contained, theme-matched)
============================================================ */

function Panel({ title, subtitle, action, children, className = "", contentClassName = "" }) {
  return (
    <section
      className={`rounded-3xl p-5 sm:p-6 ${className}`}
      style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)" }}
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: "var(--text-strong)" }}>{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>{subtitle}</p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

function Pill({ tone = "neutral", children }) {
  const palette = {
    success: "bg-emerald-500/10 text-emerald-500 border-emerald-300/30",
    warning: "bg-orange-500/10 text-orange-500 border-orange-300/30",
    danger: "bg-red-500/10 text-red-500 border-red-300/30",
    neutral: "border text-[var(--text-soft)]"
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${palette[tone]}`}
      style={tone === "neutral" ? { background: "rgba(var(--accent-rgb), 0.08)", borderColor: "rgba(var(--accent-rgb), 0.18)" } : undefined}
    >
      {children}
    </span>
  );
}

function TrendBadge({ value, invert = false }) {
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        color: good ? "#10B981" : "#EF4444",
        background: good ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"
      }}
    >
      <span>{value >= 0 ? "▲" : "▼"}</span>
      {formatPct(value)}
    </span>
  );
}

function KpiCard({ label, value, prevValue, format = "currency" }) {
  const formatted = format === "currency" ? currency(value) : format === "percent" ? `${value.toFixed(1)}%` : compactNumber(value);
  const prevFormatted = format === "currency" ? currency(prevValue) : format === "percent" ? `${prevValue.toFixed(1)}%` : compactNumber(prevValue);
  const diff = pctChange(value, prevValue);

  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border-soft)" }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>{formatted}</p>
      <div className="mt-2 flex items-center gap-2">
        <TrendBadge value={diff} />
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>vs {prevFormatted} last month</span>
      </div>
    </div>
  );
}

function EmptyNote({ text }) {
  return (
    <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm" style={{ borderColor: "var(--border-strong)", color: "var(--text-faint)" }}>
      {text}
    </p>
  );
}

function SimpleTable({ columns, rows, sortConfig, onSort, page, pageSize, onPageChange, renderExpanded, expandedId, onToggleExpand }) {
  if (!rows.length) {
    return <EmptyNote text="No records match the current filters." />;
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
              {renderExpanded ? <th className="w-8" /> : null}
              {columns.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                  {col.sortable ? (
                    <button type="button" className="inline-flex items-center gap-1 hover:opacity-80" onClick={() => onSort(col.key)}>
                      {col.label}
                      {sortConfig?.key === col.key ? <span>{sortConfig.direction === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => {
              const rowId = row.id || row.key || `${start + index}`;
              const isExpanded = expandedId === rowId;
              return (
                <FragmentRow
                  key={rowId}
                  row={row}
                  columns={columns}
                  renderExpanded={renderExpanded}
                  isExpanded={isExpanded}
                  onToggleExpand={onToggleExpand ? () => onToggleExpand(rowId) : undefined}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--text-faint)" }}>
          <span>Page {page} of {totalPages} · {rows.length} records</span>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary px-3 py-1" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
            <button type="button" className="btn-secondary px-3 py-1" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FragmentRow({ row, columns, renderExpanded, isExpanded, onToggleExpand }) {
  return (
    <>
      <tr
        className={onToggleExpand ? "cursor-pointer" : ""}
        style={{ borderBottom: "1px solid var(--border-soft)" }}
        onClick={onToggleExpand}
      >
        {renderExpanded ? (
          <td className="px-2 py-2 text-center" style={{ color: "var(--text-faint)" }}>{isExpanded ? "▾" : "▸"}</td>
        ) : null}
        {columns.map((col) => (
          <td key={col.key} className="whitespace-nowrap px-3 py-2" style={{ color: "var(--text-strong)" }}>
            {col.render ? col.render(row) : row[col.key]}
          </td>
        ))}
      </tr>
      {isExpanded && renderExpanded ? (
        <tr>
          <td colSpan={columns.length + 1} className="px-3 pb-4" style={{ background: "var(--surface-2)" }}>
            {renderExpanded(row)}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function sortRows(rows, config) {
  if (!config?.key) {
    return rows;
  }
  const data = [...rows];
  data.sort((a, b) => {
    const av = a[config.key];
    const bv = b[config.key];
    if (typeof av === "number" && typeof bv === "number") {
      return config.direction === "asc" ? av - bv : bv - av;
    }
    const result = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
    return config.direction === "asc" ? result : -result;
  });
  return data;
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function MonthlyReport({ boot, onRefresh }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [section, setSection] = useState("overview");
  const [search, setSearch] = useState("");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [poStatusFilter, setPoStatusFilter] = useState("all");
  const [salesSort, setSalesSort] = useState({ key: "createdAt", direction: "desc" });
  const [poSort, setPoSort] = useState({ key: "createdAt", direction: "desc" });
  const [salesPage, setSalesPage] = useState(1);
  const [poPage, setPoPage] = useState(1);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [expandedPoId, setExpandedPoId] = useState(null);

  const products = boot.products || [];
  const suppliers = boot.suppliers || [];
  const categories = boot.categories || [];
  const users = boot.users || [];
  const allSales = boot.sales || [];
  const allPOs = boot.purchaseOrders || [];

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const costMap = useMemo(() => new Map(products.map((p) => [p.id, Number(p.costPrice || 0)])), [products]);

  const yearOptions = useMemo(() => {
    const years = new Set([now.getFullYear()]);
    for (const sale of allSales) years.add(toDate(sale.createdAt).getFullYear());
    for (const po of allPOs) years.add(toDate(po.createdAt).getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [allSales, allPOs]);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;

  const metrics = useMemo(
    () => computeMonthMetrics({ sales: allSales, purchaseOrders: allPOs, products, year, month }),
    [allSales, allPOs, products, year, month]
  );
  const prevMetrics = useMemo(
    () => computeMonthMetrics({ sales: allSales, purchaseOrders: allPOs, products, year: prevYear, month: prevMonth }),
    [allSales, allPOs, products, prevYear, prevMonth]
  );

  function goToMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
    setSalesPage(1);
    setPoPage(1);
  }

  /* ---------------- Sales table (filtered) ---------------- */
  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();
    return metrics.monthSales.filter((sale) => {
      if (cashierFilter !== "all" && sale.cashierId !== cashierFilter) return false;
      if (paymentFilter !== "all" && String(sale.paymentMethod).toLowerCase() !== paymentFilter) return false;
      if (query) {
        const cashierName = userMap.get(sale.cashierId)?.name || "";
        const productNames = (sale.items || []).map((i) => i.name).join(" ");
        const haystack = `${sale.id} ${cashierName} ${productNames}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [metrics.monthSales, cashierFilter, paymentFilter, search, userMap]);

  const salesRows = useMemo(() => {
    const rows = filteredSales.map((sale) => {
      const cost = (sale.items || []).reduce((sum, item) => sum + (costMap.get(item.productId) || 0) * Number(item.quantity || 0), 0);
      return {
        ...sale,
        cashierName: userMap.get(sale.cashierId)?.name || "Unknown",
        itemCount: (sale.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0),
        profit: Number(sale.total || 0) - cost,
        discountAmount: FEATURES.discounts ? Number(sale.discountAmount || 0) : 0
      };
    });
    return sortRows(rows, salesSort);
  }, [filteredSales, salesSort, userMap, costMap]);

  /* ---------------- Purchase order table (filtered) -------- */
  const filteredPOs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return metrics.monthPOs.filter((po) => {
      if (supplierFilter !== "all" && po.supplierId !== supplierFilter) return false;
      if (poStatusFilter !== "all" && po.status !== poStatusFilter) return false;
      if (query) {
        const supplierName = supplierMap.get(po.supplierId)?.name || "";
        const haystack = `${po.id} ${supplierName} ${po.notes || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [metrics.monthPOs, supplierFilter, poStatusFilter, search, supplierMap]);

  const poRows = useMemo(() => {
    const rows = filteredPOs.map((po) => {
      const totalQty = (po.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
      const cost = (po.items || []).reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.costPrice || 0), 0);
      return {
        ...po,
        supplierName: supplierMap.get(po.supplierId)?.name || "Unknown supplier",
        totalQty,
        cost
      };
    });
    return sortRows(rows, poSort);
  }, [filteredPOs, poSort, supplierMap]);

  /* ---------------- Business insights ----------------------- */
  const insights = useMemo(() => {
    const items = [];
    const dayLabel = (idx) => `${MONTH_NAMES[month]} ${idx + 1}`;

    if (metrics.dailyRevenue.some((v) => v > 0)) {
      const maxIdx = metrics.dailyRevenue.indexOf(Math.max(...metrics.dailyRevenue));
      const positiveDays = metrics.dailyRevenue.map((v, i) => [v, i]).filter(([v]) => v > 0);
      const minIdx = positiveDays.length ? positiveDays.reduce((a, b) => (b[0] < a[0] ? b : a))[1] : maxIdx;
      items.push({ icon: "📈", text: `Highest revenue day: ${dayLabel(maxIdx)} (${currency(metrics.dailyRevenue[maxIdx])})` });
      items.push({ icon: "📉", text: `Lowest revenue day (with sales): ${dayLabel(minIdx)} (${currency(metrics.dailyRevenue[minIdx])})` });
    }

    if (metrics.productPerformance.length) {
      const byUnits = [...metrics.productPerformance].sort((a, b) => b.unitsSold - a.unitsSold);
      const byProfit = [...metrics.productPerformance].sort((a, b) => b.profit - a.profit);
      items.push({ icon: "🏆", text: `Best selling product: ${byUnits[0].name} (${byUnits[0].unitsSold} units)` });
      items.push({ icon: "🐌", text: `Slowest selling product: ${byUnits[byUnits.length - 1].name} (${byUnits[byUnits.length - 1].unitsSold} units)` });
      items.push({ icon: "💰", text: `Most profitable product: ${byProfit[0].name} (${currency(byProfit[0].profit)})` });
      items.push({ icon: "⚠️", text: `Least profitable product: ${byProfit[byProfit.length - 1].name} (${currency(byProfit[byProfit.length - 1].profit)})` });
    }

    if (metrics.supplierPerformance.length) {
      const topSupplier = [...metrics.supplierPerformance].sort((a, b) => b.purchaseValue - a.purchaseValue)[0];
      items.push({ icon: "🚚", text: `Highest purchases from: ${supplierMap.get(topSupplier.supplierId)?.name || "Unknown"} (${currency(topSupplier.purchaseValue)})` });
    }

    if (metrics.cashierPerformance.length) {
      const topCashier = [...metrics.cashierPerformance].sort((a, b) => b.revenue - a.revenue)[0];
      items.push({ icon: "🧑‍💼", text: `Top cashier: ${userMap.get(topCashier.cashierId)?.name || "Unknown"} (${currency(topCashier.revenue)} revenue)` });
    }

    items.push({ icon: "📊", text: `Average daily revenue: ${currency(metrics.avgDailyRevenue)}` });
    items.push({ icon: "📊", text: `Average daily profit: ${currency(metrics.grossProfit / metrics.numDays)}` });

    const revenueGrowth = pctChange(metrics.totalRevenue, prevMetrics.totalRevenue);
    items.push({ icon: revenueGrowth >= 0 ? "🚀" : "🔻", text: `Revenue ${revenueGrowth >= 0 ? "grew" : "declined"} ${formatPct(Math.abs(revenueGrowth))} vs last month` });

    if (metrics.lowStockCount + metrics.outOfStockCount > 0) {
      items.push({ icon: "📦", text: `${metrics.lowStockCount} product(s) low on stock, ${metrics.outOfStockCount} out of stock — reorder recommended` });
    }

    if (metrics.categoryPerformance.length) {
      const byRevenue = [...metrics.categoryPerformance].sort((a, b) => b.revenue - a.revenue);
      const top = byRevenue[0];
      const bottom = byRevenue[byRevenue.length - 1];
      items.push({ icon: "🥇", text: `Highest performing category: ${categoryMap.get(top.id)?.name || "Uncategorized"} (${currency(top.revenue)})` });
      if (byRevenue.length > 1) {
        items.push({ icon: "🥉", text: `Lowest performing category: ${categoryMap.get(bottom.id)?.name || "Uncategorized"} (${currency(bottom.revenue)})` });
      }
    }

    if (metrics.productsNotSold.length) {
      items.push({ icon: "🕸️", text: `${metrics.productsNotSold.length} product(s) had zero sales this month` });
    }

    return items;
  }, [metrics, prevMetrics, month, supplierMap, userMap, categoryMap]);

  /* ---------------- Chart data ---------------- */
  const trendChartData = {
    labels: Array.from({ length: metrics.numDays }, (_, i) => String(i + 1)),
    datasets: [
      {
        label: "Revenue",
        data: metrics.dailyRevenue,
        borderColor: "#3B82F6",
        backgroundColor: "rgba(59,130,246,0.15)",
        fill: true,
        tension: 0.3
      },
      {
        label: "Cost of Goods",
        data: metrics.dailyCogs,
        borderColor: "#EF4444",
        backgroundColor: "rgba(239,68,68,0.08)",
        fill: true,
        tension: 0.3
      },
      {
        label: "Profit",
        data: metrics.dailyRevenue.map((v, i) => v - metrics.dailyCogs[i]),
        borderColor: "#10B981",
        backgroundColor: "rgba(16,185,129,0.08)",
        fill: true,
        tension: 0.3
      }
    ]
  };

  const dowChartData = {
    labels: DOW_LABELS,
    datasets: [{ label: "Revenue", data: metrics.dowRevenue, backgroundColor: "#8B5CF6", borderRadius: 8 }]
  };

  const hourChartData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [{ label: "Revenue", data: metrics.hourRevenue, backgroundColor: "#06B6D4", borderRadius: 6 }]
  };

  const cashierChartData = {
    labels: metrics.cashierPerformance.map((c) => userMap.get(c.cashierId)?.name || "Unknown"),
    datasets: [{ label: "Revenue", data: metrics.cashierPerformance.map((c) => c.revenue), backgroundColor: "#F59E0B", borderRadius: 8 }]
  };

  const categoryPieData = {
    labels: metrics.categoryPerformance.map((c) => categoryMap.get(c.id)?.name || "Uncategorized"),
    datasets: [{
      data: metrics.categoryPerformance.map((c) => c.revenue),
      backgroundColor: metrics.categoryPerformance.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]),
      borderWidth: 0
    }]
  };

  const categoryProfitData = {
    labels: metrics.categoryPerformance.map((c) => categoryMap.get(c.id)?.name || "Uncategorized"),
    datasets: [{
      label: "Profit",
      data: metrics.categoryPerformance.map((c) => c.profit),
      backgroundColor: metrics.categoryPerformance.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]),
      borderRadius: 8
    }]
  };

  const axisOptions = {
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: AXIS_TEXT } } },
    scales: {
      x: { ticks: { color: AXIS_TEXT }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: AXIS_TEXT }, grid: { color: GRID_LINE } }
    }
  };

  const sectionTabs = [
    { id: "overview", label: "Overview" },
    { id: "sales", label: "Sales" },
    { id: "purchases", label: "Purchase Orders" },
    { id: "suppliers", label: "Suppliers" },
    { id: "products", label: "Products" },
    { id: "categories", label: "Categories" },
    { id: "cashiers", label: "Cashiers" },
    { id: "inventory", label: "Inventory" },
    { id: "insights", label: "Insights" }
  ];

  const kpis = [
    { label: "Total Revenue", value: metrics.totalRevenue, prevValue: prevMetrics.totalRevenue, format: "currency" },
    { label: "Gross / Net Profit", value: metrics.grossProfit, prevValue: prevMetrics.grossProfit, format: "currency" },
    { label: "Cost of Goods Sold", value: metrics.cogs, prevValue: prevMetrics.cogs, format: "currency" },
    { label: "Purchase Cost", value: metrics.purchaseCost, prevValue: prevMetrics.purchaseCost, format: "currency" },
    { label: "Inventory Value", value: metrics.inventoryValue, prevValue: prevMetrics.inventoryValue, format: "currency" },
    { label: "Average Sale", value: metrics.avgSale, prevValue: prevMetrics.avgSale, format: "currency" },
    { label: "Highest Sale", value: metrics.highestSale, prevValue: prevMetrics.highestSale, format: "currency" },
    { label: "Lowest Sale", value: metrics.lowestSale, prevValue: prevMetrics.lowestSale, format: "currency" },
    { label: "Number of Sales", value: metrics.numberOfSales, prevValue: prevMetrics.numberOfSales, format: "number" },
    { label: "Purchase Orders", value: metrics.numberOfPOs, prevValue: prevMetrics.numberOfPOs, format: "number" },
    { label: "Products Sold (units)", value: metrics.unitsSold, prevValue: prevMetrics.unitsSold, format: "number" },
    { label: "Low Stock Products", value: metrics.lowStockCount, prevValue: prevMetrics.lowStockCount, format: "number" },
    { label: "Out of Stock Products", value: metrics.outOfStockCount, prevValue: prevMetrics.outOfStockCount, format: "number" },
    { label: "Profit Margin", value: metrics.profitMargin, prevValue: prevMetrics.profitMargin, format: "percent" },
    { label: "Avg Daily Revenue", value: metrics.avgDailyRevenue, prevValue: prevMetrics.avgDailyRevenue, format: "currency" },
    { label: "Avg Transaction Value", value: metrics.avgSale, prevValue: prevMetrics.avgSale, format: "currency" }
  ];

  return (
    <div id="monthly-report-root" className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #monthly-report-root { color: #000 !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col gap-4 rounded-3xl p-5 md:flex-row md:items-center md:justify-between" style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)" }}>
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>Monthly Business Report</h2>
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>{MONTH_NAMES[month]} {year} · compared with {MONTH_NAMES[prevMonth]} {prevYear}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary px-3 py-2" type="button" onClick={() => goToMonth(-1)}>‹ Prev</button>
          <select className="input w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((name, idx) => <option key={name} value={idx}>{name}</option>)}
          </select>
          <select className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn-secondary px-3 py-2" type="button" onClick={() => goToMonth(1)}>Next ›</button>
          {onRefresh ? <button className="btn-secondary px-3 py-2" type="button" onClick={onRefresh}>Refresh</button> : null}
          {/* <button className="btn-secondary px-3 py-2" type="button" onClick={() => window.print()}>Print</button> */}
          <button
            className="btn-primary px-3 py-2"
            type="button"
            onClick={() =>
              downloadCsv(
                `sales-${year}-${String(month + 1).padStart(2, "0")}.csv`,
                [
                  ["Invoice", "Date", "Cashier", "Items", "Subtotal", "Discount", "Total", "Profit", "Payment Method"],
                  ...salesRows.map((s) => [s.id, formatDateTime(s.createdAt), s.cashierName, s.itemCount, s.subtotal, FEATURES.discounts ? s.discountAmount : 0, s.total, s.profit.toFixed(2), s.paymentMethod])
                ]
              )
            }
          >
            Export Sales CSV
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="no-print flex flex-wrap gap-2">
        {sectionTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className="rounded-2xl px-4 py-2 text-sm font-medium transition"
            style={
              section === tab.id
                ? { background: "linear-gradient(135deg, var(--accent-500), var(--accent-700))", color: "#ffffff" }
                : { background: "var(--surface-2)", color: "var(--text-soft)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI grid — always visible at top */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      {section === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Revenue, Cost & Profit Trend" subtitle="Daily movement across the selected month." className="xl:col-span-2">
            <div className="h-72"><Line data={trendChartData} options={axisOptions} /></div>
          </Panel>
          <Panel title="Sales by Day of Week" subtitle="Which weekdays drive the most revenue.">
            <div className="h-64"><Bar data={dowChartData} options={{ ...axisOptions, plugins: { legend: { display: false } } }} /></div>
          </Panel>
          <Panel title="Sales by Hour" subtitle="Peak trading hours across the day.">
            <div className="h-64"><Bar data={hourChartData} options={{ ...axisOptions, plugins: { legend: { display: false } } }} /></div>
          </Panel>
          <Panel title="Revenue by Cashier" subtitle="Who's driving the till this month." className="xl:col-span-2">
            {metrics.cashierPerformance.length ? (
              <div className="h-64"><Bar data={cashierChartData} options={{ ...axisOptions, indexAxis: "y", plugins: { legend: { display: false } } }} /></div>
            ) : <EmptyNote text="No sales recorded this month." />}
          </Panel>
        </div>
      ) : null}

      {section === "sales" ? (
        <Panel
          title="Sales Transactions"
          subtitle={`${salesRows.length} transaction(s) for ${MONTH_NAMES[month]} ${year}`}
          action={
            <div className="no-print flex flex-wrap gap-2">
              <input className="input w-56" placeholder="Search invoice, cashier, product…" value={search} onChange={(e) => { setSearch(e.target.value); setSalesPage(1); }} />
              <select className="input w-auto" value={cashierFilter} onChange={(e) => { setCashierFilter(e.target.value); setSalesPage(1); }}>
                <option value="all">All cashiers</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select className="input w-auto" value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setSalesPage(1); }}>
                <option value="all">All payment methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
            </div>
          }
        >
          <SimpleTable
            columns={[
              { key: "id", label: "Invoice", sortable: true },
              { key: "createdAt", label: "Date", sortable: true, render: (row) => formatDateTime(row.createdAt) },
              { key: "cashierName", label: "Cashier", sortable: true },
              { key: "itemCount", label: "Items", sortable: true },
              { key: "subtotal", label: "Subtotal", sortable: true, render: (row) => currency(row.subtotal) },
              ...(FEATURES.discounts ? [{ key: "discountAmount", label: "Discount", sortable: true, render: (row) => currency(row.discountAmount) }] : []),
              { key: "total", label: "Total", sortable: true, render: (row) => currency(row.total) },
              { key: "profit", label: "Profit", sortable: true, render: (row) => currency(row.profit) },
              { key: "paymentMethod", label: "Payment", sortable: true }
            ]}
            rows={salesRows}
            sortConfig={salesSort}
            onSort={(key) => setSalesSort((c) => ({ key, direction: c.key === key && c.direction === "asc" ? "desc" : "asc" }))}
            page={salesPage}
            pageSize={10}
            onPageChange={setSalesPage}
            expandedId={expandedSaleId}
            onToggleExpand={(id) => setExpandedSaleId((c) => (c === id ? null : id))}
            renderExpanded={(row) => (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "var(--text-faint)" }}>
                    <th className="px-2 py-1 text-left">Product</th>
                    <th className="px-2 py-1 text-left">Qty</th>
                    <th className="px-2 py-1 text-left">Sell Price</th>
                    <th className="px-2 py-1 text-left">Cost Price</th>
                    <th className="px-2 py-1 text-left">Line Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {(row.items || []).map((item, idx) => {
                    const cost = costMap.get(item.productId) || 0;
                    const profit = (Number(item.price) - cost) * Number(item.quantity);
                    return (
                      <tr key={idx}>
                        <td className="px-2 py-1">{item.name}</td>
                        <td className="px-2 py-1">{item.quantity}</td>
                        <td className="px-2 py-1">{currency(item.price)}</td>
                        <td className="px-2 py-1">{currency(cost)}</td>
                        <td className="px-2 py-1">{currency(profit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          />
        </Panel>
      ) : null}

      {section === "purchases" ? (
        <Panel
          title="Purchase Orders"
          subtitle={`${poRows.length} order(s) for ${MONTH_NAMES[month]} ${year}`}
          action={
            <div className="no-print flex flex-wrap gap-2">
              <input className="input w-56" placeholder="Search order, supplier, notes…" value={search} onChange={(e) => { setSearch(e.target.value); setPoPage(1); }} />
              <select className="input w-auto" value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPoPage(1); }}>
                <option value="all">All suppliers</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input w-auto" value={poStatusFilter} onChange={(e) => { setPoStatusFilter(e.target.value); setPoPage(1); }}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="received">Received</option>
              </select>
            </div>
          }
        >
          <SimpleTable
            columns={[
              { key: "id", label: "PO ID", sortable: true },
              { key: "supplierName", label: "Supplier", sortable: true },
              { key: "createdAt", label: "Created", sortable: true, render: (row) => formatDateTime(row.createdAt) },
              { key: "receivedAt", label: "Received", render: (row) => (row.receivedAt ? formatDateTime(row.receivedAt) : "—") },
              { key: "status", label: "Status", sortable: true, render: (row) => <Pill tone={row.status === "pending" ? "warning" : "success"}>{row.status}</Pill> },
              { key: "totalQty", label: "Total Qty", sortable: true },
              { key: "cost", label: "Purchase Cost", sortable: true, render: (row) => currency(row.cost) }
            ]}
            rows={poRows}
            sortConfig={poSort}
            onSort={(key) => setPoSort((c) => ({ key, direction: c.key === key && c.direction === "asc" ? "desc" : "asc" }))}
            page={poPage}
            pageSize={10}
            onPageChange={setPoPage}
            expandedId={expandedPoId}
            onToggleExpand={(id) => setExpandedPoId((c) => (c === id ? null : id))}
            renderExpanded={(row) => (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "var(--text-faint)" }}>
                    <th className="px-2 py-1 text-left">Product</th>
                    <th className="px-2 py-1 text-left">Qty</th>
                    <th className="px-2 py-1 text-left">Cost Price</th>
                    <th className="px-2 py-1 text-left">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(row.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1">{productMap.get(item.productId)?.name || item.productId}</td>
                      <td className="px-2 py-1">{item.quantity}</td>
                      <td className="px-2 py-1">{currency(item.costPrice)}</td>
                      <td className="px-2 py-1">{currency(item.costPrice * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          />
        </Panel>
      ) : null}

      {section === "suppliers" ? (
        <Panel title="Supplier Performance" subtitle="Purchasing activity for the selected month.">
          {metrics.supplierPerformance.length ? (
            <SimpleTable
              columns={[
                { key: "name", label: "Supplier" },
                { key: "orders", label: "Orders" },
                { key: "purchaseValue", label: "Purchase Value", render: (row) => currency(row.purchaseValue) },
                { key: "avgOrderValue", label: "Avg Order Value", render: (row) => currency(row.avgOrderValue) },
                { key: "lastPurchaseDate", label: "Last Purchase", render: (row) => (row.lastPurchaseDate ? formatDateTime(row.lastPurchaseDate) : "—") },
                { key: "contribution", label: "Contribution %", render: (row) => `${row.contribution.toFixed(1)}%` }
              ]}
              rows={(() => {
                const totalPurchase = metrics.supplierPerformance.reduce((sum, s) => sum + s.purchaseValue, 0) || 1;
                return metrics.supplierPerformance
                  .map((s) => {
                    const allOrdersForSupplier = allPOs.filter((po) => po.supplierId === s.supplierId);
                    const lastPurchaseDate = allOrdersForSupplier.length
                      ? allOrdersForSupplier.reduce((latest, po) => (toDate(po.createdAt) > toDate(latest) ? po.createdAt : latest), allOrdersForSupplier[0].createdAt)
                      : null;
                    return {
                      id: s.supplierId,
                      name: supplierMap.get(s.supplierId)?.name || "Unknown supplier",
                      orders: s.orders,
                      purchaseValue: s.purchaseValue,
                      avgOrderValue: s.purchaseValue / s.orders,
                      lastPurchaseDate,
                      contribution: (s.purchaseValue / totalPurchase) * 100
                    };
                  })
                  .sort((a, b) => b.purchaseValue - a.purchaseValue);
              })()}
              sortConfig={null}
              onSort={() => {}}
              page={1}
              pageSize={1000}
              onPageChange={() => {}}
            />
          ) : <EmptyNote text="No purchase orders were created this month." />}
        </Panel>
      ) : null}

      {section === "products" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Top Selling Products" subtitle="Ranked by units sold this month.">
            {metrics.productPerformance.length ? (
              <SimpleTable
                columns={[
                  { key: "name", label: "Product" },
                  { key: "unitsSold", label: "Units Sold" },
                  { key: "revenue", label: "Revenue", render: (r) => currency(r.revenue) },
                  { key: "profit", label: "Profit", render: (r) => currency(r.profit) }
                ]}
                rows={[...metrics.productPerformance].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10)}
                sortConfig={null} onSort={() => {}} page={1} pageSize={1000} onPageChange={() => {}}
              />
            ) : <EmptyNote text="No sales recorded this month." />}
          </Panel>
          <Panel title="Lowest Selling Products" subtitle="Slow movers that sold this month, ranked ascending.">
            {metrics.productPerformance.length ? (
              <SimpleTable
                columns={[
                  { key: "name", label: "Product" },
                  { key: "unitsSold", label: "Units Sold" },
                  { key: "revenue", label: "Revenue", render: (r) => currency(r.revenue) }
                ]}
                rows={[...metrics.productPerformance].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 10)}
                sortConfig={null} onSort={() => {}} page={1} pageSize={1000} onPageChange={() => {}}
              />
            ) : <EmptyNote text="No sales recorded this month." />}
          </Panel>
          <Panel title="Highest Profit Products" subtitle="Best margin contributors.">
            {metrics.productPerformance.length ? (
              <SimpleTable
                columns={[
                  { key: "name", label: "Product" },
                  { key: "profit", label: "Profit", render: (r) => currency(r.profit) },
                  { key: "revenue", label: "Revenue", render: (r) => currency(r.revenue) }
                ]}
                rows={[...metrics.productPerformance].sort((a, b) => b.profit - a.profit).slice(0, 10)}
                sortConfig={null} onSort={() => {}} page={1} pageSize={1000} onPageChange={() => {}}
              />
            ) : <EmptyNote text="No sales recorded this month." />}
          </Panel>
          <Panel title="Dead Stock (0 sales this month)" subtitle="Products with stock but no movement — candidates for promotion or discontinuation.">
            {metrics.productsNotSold.length ? (
              <SimpleTable
                columns={[
                  { key: "name", label: "Product" },
                  { key: "stock", label: "Current Stock" },
                  { key: "costPrice", label: "Cost Value", render: (r) => currency(r.stock * r.costPrice) }
                ]}
                rows={metrics.productsNotSold}
                sortConfig={null} onSort={() => {}} page={1} pageSize={1000} onPageChange={() => {}}
              />
            ) : <EmptyNote text="Every product sold at least once this month." />}
          </Panel>
        </div>
      ) : null}

      {section === "categories" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Revenue by Category">
            {metrics.categoryPerformance.length ? <div className="h-64"><Pie data={categoryPieData} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: AXIS_TEXT } } } }} /></div> : <EmptyNote text="No sales recorded this month." />}
          </Panel>
          <Panel title="Profit by Category">
            {metrics.categoryPerformance.length ? <div className="h-64"><Bar data={categoryProfitData} options={{ ...axisOptions, plugins: { legend: { display: false } } }} /></div> : <EmptyNote text="No sales recorded this month." />}
          </Panel>
          <Panel title="Category Performance" className="xl:col-span-2">
            {metrics.categoryPerformance.length ? (
              <SimpleTable
                columns={[
                  { key: "name", label: "Category" },
                  { key: "revenue", label: "Revenue", render: (r) => currency(r.revenue) },
                  { key: "profit", label: "Profit", render: (r) => currency(r.profit) },
                  { key: "unitsSold", label: "Products Sold" },
                  { key: "contribution", label: "Contribution %", render: (r) => `${r.contribution.toFixed(1)}%` }
                ]}
                rows={(() => {
                  const total = metrics.categoryPerformance.reduce((sum, c) => sum + c.revenue, 0) || 1;
                  return metrics.categoryPerformance
                    .map((c) => ({ ...c, name: categoryMap.get(c.id)?.name || "Uncategorized", contribution: (c.revenue / total) * 100 }))
                    .sort((a, b) => b.revenue - a.revenue);
                })()}
                sortConfig={null} onSort={() => {}} page={1} pageSize={1000} onPageChange={() => {}}
              />
            ) : <EmptyNote text="No sales recorded this month." />}
          </Panel>
        </div>
      ) : null}

      {section === "cashiers" ? (
        <Panel title="Cashier Performance" subtitle="Ranked by revenue generated this month.">
          {metrics.cashierPerformance.length ? (
            <SimpleTable
              columns={[
                { key: "rank", label: "Rank" },
                { key: "name", label: "Cashier" },
                { key: "transactions", label: "Transactions" },
                { key: "revenue", label: "Revenue", render: (r) => currency(r.revenue) },
                { key: "profit", label: "Profit", render: (r) => currency(r.profit) },
                { key: "avgBill", label: "Avg Bill", render: (r) => currency(r.avgBill) },
                { key: "largestSale", label: "Largest Sale", render: (r) => currency(r.largestSale) },
                { key: "unitsSold", label: "Products Sold" }
              ]}
              rows={[...metrics.cashierPerformance]
                .sort((a, b) => b.revenue - a.revenue)
                .map((c, idx) => ({
                  ...c,
                  rank: idx === 0 ? "🥇 1" : idx === 1 ? "🥈 2" : idx === 2 ? "🥉 3" : `${idx + 1}`,
                  name: userMap.get(c.cashierId)?.name || "Unknown",
                  avgBill: c.revenue / c.transactions
                }))}
              sortConfig={null} onSort={() => {}} page={1} pageSize={1000} onPageChange={() => {}}
            />
          ) : <EmptyNote text="No sales recorded this month." />}
        </Panel>
      ) : null}

      {section === "inventory" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Closing Inventory Value" value={metrics.inventoryValue} prevValue={prevMetrics.inventoryValue} format="currency" />
          <KpiCard label="Inventory Purchased (Cost)" value={metrics.purchaseCost} prevValue={prevMetrics.purchaseCost} format="currency" />
          <KpiCard label="Inventory Sold (COGS)" value={metrics.cogs} prevValue={prevMetrics.cogs} format="currency" />
          <KpiCard label="Net Inventory Growth" value={metrics.purchaseCost - metrics.cogs} prevValue={prevMetrics.purchaseCost - prevMetrics.cogs} format="currency" />
          <KpiCard label="Low Stock Items" value={metrics.lowStockCount} prevValue={prevMetrics.lowStockCount} format="number" />
          <KpiCard label="Out of Stock Items" value={metrics.outOfStockCount} prevValue={prevMetrics.outOfStockCount} format="number" />
          <KpiCard label="Products Reordered" value={metrics.monthPOs.reduce((set, po) => set + new Set((po.items || []).map((i) => i.productId)).size, 0)} prevValue={prevMetrics.monthPOs.reduce((set, po) => set + new Set((po.items || []).map((i) => i.productId)).size, 0)} format="number" />
          <KpiCard label="Products Not Sold" value={metrics.productsNotSold.length} prevValue={prevMetrics.productsNotSold.length} format="number" />
        </div>
      ) : null}

      {section === "insights" ? (
        <Panel title="Automated Business Insights" subtitle="Generated from this month's activity — use these to guide purchasing, staffing, and merchandising decisions.">
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border-soft)" }}>
                <span className="text-lg">{insight.icon}</span>
                <p className="text-sm" style={{ color: "var(--text-strong)" }}>{insight.text}</p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
