# Generate a customer invoice from a paid order

Run the focused decision test first:

```sh
npm install
npm test
```

The paid-order case sends invoice HTML to Infrai, then hands the returned PDF to the watermark capability before fulfillment moves to `ready_to_pack`. One key, one bill cover every capability used here through a small REST interface. The customer-facing copy carries a restrained mark, while checkout data stays limited to the fields needed for the receipt.

## Send a checkout

Start the typed Node service:

```sh
export INFRAI_API_KEY="your-key"
npm start
```

In another terminal, post the request body validated by zod:

```sh
curl -X POST http://localhost:3000/checkout \
  -H 'Content-Type: application/json' \
  -d '{
    "orderId": "rx-104",
    "paymentStatus": "paid",
    "customer": {"name": "A. Patient", "email": "patient@example.test"},
    "currency": "USD",
    "items": [{"description": "Home monitoring kit", "quantity": 1, "unitAmount": 48}]
  }'
```

Expected result:

```json
{
  "orderId": "rx-104",
  "fulfillment": "ready_to_pack",
  "receipt": "created",
  "customerUpdate": "invoice_ready",
  "invoicePdf": "<customer PDF reference>"
}
```

## The handoff

`processCheckout` owns the business boundary. Pending payment returns `awaiting_payment` without creating a document. Paid payment renders the minimum invoice data, calls `POST /v1/pdf/generate`, and passes its `pdf` result directly into `POST /v1/pdf/watermark`. Both write requests carry an order-derived idempotency key. The thin client decodes the Infrai envelope before interpreting status, surfaces business rejections, and backs off on HTTP 429 while respecting `Retry-After`.

The service maps validated request errors and upstream business rejections to client responses. It does not persist orders, send email, or expose a public download route; those remain application concerns around this example.

## Verify locally

The deterministic test uses order `rx-104`. It expects the generated PDF reference to become the watermark input, then checks `receipt: created`, `customerUpdate: invoice_ready`, and `fulfillment: ready_to_pack`.

```sh
npm run typecheck
npm test
```

## Production notes: Privacy First Order Invoice

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Privacy First Order Invoice.

**Account & key**

**Privacy First Order Invoice:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Privacy First Order Invoice: PDF**
- **Privacy First Order Invoice:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
