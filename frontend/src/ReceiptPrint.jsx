import { forwardRef } from "react";

const ReceiptPrint = forwardRef(({ branding, sale }, ref) => {
  const subtotal = Number(
    sale.subtotal ??
      (sale.items || []).reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
        0
      )
  );
  const total = Number(sale.total ?? subtotal);
  const cashReceived = Number(sale.cashReceived ?? 0);
  const balance = Number(sale.balance ?? (cashReceived - total));
  const saleDate = new Date(sale.createdAt || Date.now());

  const formatter = new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: branding.currency || "LKR",
    maximumFractionDigits: 2
  });

  const formatCurrency = (value) => formatter.format(Number(value || 0));
  const formatDate = (date) => date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const formatTime = (date) => date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <article
      ref={ref}
      className="receipt-print-root"
      style={{
        width: "80mm",
        margin: "0 auto",
        padding: "16px",
        background: "#ffffff",
        color: "#000000",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: "11px",
        lineHeight: 1.4
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        {branding.printStoreLogo && branding.storeLogo ? (
          <img
            src={branding.storeLogo}
            alt={branding.storeName}
            style={{
              width: "56px",
              height: "56px",
              objectFit: "contain",
              margin: "0 auto 10px",
              display: "block"
            }}
          />
        ) : null}
        <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>{branding.storeName}</div>
        {branding.printStoreAddress && branding.businessAddress ? (
          <div style={{ fontSize: "9px", whiteSpace: "pre-wrap", color: "#111111", marginBottom: "4px" }}>
            {branding.businessAddress}
          </div>
        ) : null}
        {branding.printPhoneNumber && branding.phoneNumber ? (
          <div style={{ fontSize: "9px", color: "#111111" }}>Phone: {branding.phoneNumber}</div>
        ) : null}
      </div>

      <div style={{ borderTop: "1px solid #d1d5db", margin: "12px 0" }} />

      <div style={{ fontSize: "10px", color: "#111111" }}>
        <ReceiptRow label="Invoice" value={sale.id || "-"} />
        <ReceiptRow label="Date" value={formatDate(saleDate)} />
        <ReceiptRow label="Time" value={formatTime(saleDate)} />
        {branding.printCashierName ? <ReceiptRow label="Cashier" value={sale.cashierName || sale.cashierId || "-"} /> : null}
        <ReceiptRow label="Payment" value={String(sale.paymentMethod || "").replace(/_/g, " ")} />
      </div>

      <div style={{ borderTop: "1px solid #d1d5db", margin: "12px 0" }} />

      <div style={{ fontSize: "10px", marginBottom: "8px", fontWeight: 700 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>ITEM</span>
          <span style={{ textAlign: "right" }}>TOTAL</span>
        </div>
      </div>

      <div style={{ fontSize: "10px" }}>
        {(sale.items || []).map((item) => {
          const quantity = Number(item.quantity || 0);
          const unitPrice = Number(item.price || 0);
          const lineTotal = quantity * unitPrice;
          return (
            <div key={`${item.productId}-${item.name}-${quantity}`} style={{ marginBottom: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                <span>{item.name}</span>
                <span>{formatCurrency(lineTotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#475569", fontSize: "9px", marginTop: "2px" }}>
                <span>{quantity} x {formatCurrency(unitPrice)}</span>
                <span>{formatCurrency(lineTotal)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid #d1d5db", margin: "12px 0" }} />

      <div style={{ fontSize: "10px", color: "#111111" }}>
        <ReceiptRow label="Subtotal" value={formatCurrency(subtotal)} />
        <ReceiptRow label="Grand Total" value={formatCurrency(total)} bold />
        {String(sale.paymentMethod || "").toLowerCase() === "cash" ? (
          <>
            <ReceiptRow label="Cash Received" value={formatCurrency(cashReceived)} />
            <ReceiptRow label="Balance" value={formatCurrency(balance)} />
          </>
        ) : null}
      </div>

      {branding.receiptFooter ? (
        <>
          <div style={{ borderTop: "1px solid #d1d5db", margin: "14px 0 8px" }} />
          <div style={{ fontSize: "9px", color: "#111111", textAlign: "center", whiteSpace: "pre-wrap" }}>
            {branding.receiptFooter}
          </div>
        </>
      ) : null}
    </article>
  );
});

function ReceiptRow({ label, value, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

ReceiptPrint.displayName = "ReceiptPrint";

export default ReceiptPrint;
