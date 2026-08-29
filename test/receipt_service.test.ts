import assert from "node:assert/strict";
import test from "node:test";
import type { InvoicePdfPort } from "../src/receipt_service.js";
import { processCheckout } from "../src/receipt_service.js";

test("a paid checkout creates a marked invoice and releases fulfillment", async () => {
  const handoffs: string[] = [];
  const pdf: InvoicePdfPort = {
    async generateInvoice(html, orderId) {
      assert.match(html, /Invoice rx-104/);
      handoffs.push(`generate:${orderId}`);
      return "private-pdf-reference";
    },
    async addPrivacyMark(input, orderId) {
      assert.equal(input, "private-pdf-reference");
      handoffs.push(`watermark:${orderId}`);
      return "customer-pdf-reference";
    }
  };

  const result = await processCheckout({
    orderId: "rx-104",
    paymentStatus: "paid",
    customer: { name: "A. Patient", email: "patient@example.test" },
    currency: "USD",
    items: [{ description: "Home monitoring kit", quantity: 1, unitAmount: 48 }]
  }, pdf);

  assert.deepEqual(handoffs, ["generate:rx-104", "watermark:rx-104"]);
  assert.deepEqual(result, {
    orderId: "rx-104",
    fulfillment: "ready_to_pack",
    receipt: "created",
    customerUpdate: "invoice_ready",
    invoicePdf: "customer-pdf-reference"
  });
});

test("a pending checkout does not create a receipt or release fulfillment", async () => {
  const pdf: InvoicePdfPort = {
    async generateInvoice() { throw new Error("unexpected call"); },
    async addPrivacyMark() { throw new Error("unexpected call"); }
  };

  const result = await processCheckout({
    orderId: "rx-105",
    paymentStatus: "pending",
    customer: { name: "B. Patient", email: "patient2@example.test" },
    currency: "USD",
    items: [{ description: "Sensor refill", quantity: 2, unitAmount: 12 }]
  }, pdf);

  assert.equal(result.fulfillment, "awaiting_payment");
  assert.equal(result.receipt, "not_created");
  assert.equal(result.customerUpdate, "payment_required");
});
