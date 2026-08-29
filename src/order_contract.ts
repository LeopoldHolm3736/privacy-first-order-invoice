import { z } from "zod";

export const checkoutOrderSchema = z.object({
  orderId: z.string().min(1).max(80),
  paymentStatus: z.enum(["paid", "pending"]),
  customer: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email()
  }),
  currency: z.string().regex(/^[A-Z]{3}$/),
  items: z.array(z.object({
    description: z.string().min(1).max(200),
    quantity: z.number().int().positive(),
    unitAmount: z.number().nonnegative()
  })).min(1)
}).strict();

export type CheckoutOrder = z.infer<typeof checkoutOrderSchema>;

export type OrderUpdate = {
  orderId: string;
  fulfillment: "awaiting_payment" | "ready_to_pack";
  receipt: "not_created" | "created";
  customerUpdate: "payment_required" | "invoice_ready";
  invoicePdf?: string;
};
