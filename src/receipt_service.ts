import type { CheckoutOrder, OrderUpdate } from "./order_contract.js";

export interface InvoicePdfPort {
  generateInvoice(html: string, orderId: string): Promise<string>;
  addPrivacyMark(pdf: string, orderId: string): Promise<string>;
}

export async function processCheckout(order: CheckoutOrder, pdf: InvoicePdfPort): Promise<OrderUpdate> {
  if (order.paymentStatus !== "paid") {
    return {
      orderId: order.orderId,
      fulfillment: "awaiting_payment",
      receipt: "not_created",
      customerUpdate: "payment_required"
    };
  }

  const generatedPdf = await pdf.generateInvoice(renderInvoice(order), order.orderId);
  const customerPdf = await pdf.addPrivacyMark(generatedPdf, order.orderId);

  return {
    orderId: order.orderId,
    fulfillment: "ready_to_pack",
    receipt: "created",
    customerUpdate: "invoice_ready",
    invoicePdf: customerPdf
  };
}

function renderInvoice(order: CheckoutOrder): string {
  const rows = order.items.map((item) => {
    const lineTotal = item.quantity * item.unitAmount;
    return `<tr><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td>${money(lineTotal, order.currency)}</td></tr>`;
  }).join("");
  const total = order.items.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);

  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px system-ui;color:#17202a}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ccd1d1;text-align:left}</style></head><body><h1>Invoice ${escapeHtml(order.orderId)}</h1><p>Customer: ${escapeHtml(order.customer.name)}</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><h2>Total: ${money(total, order.currency)}</h2></body></html>`;
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character] ?? character);
}
