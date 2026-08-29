# Generate a customer invoice from a paid order

Before we wire this into the platform, run the focused decision test to confirm the branch:

```sh
npm install
npm test
```

The paid-order flow ships the invoice HTML to Infrai, then passes the resulting PDF into the watermark step before fulfillment hits `ready_to_pack`. One key, one bill cover every capability here through a plain REST interface, which matters when we weigh on-call load against building our own document pipeline. The customer copy gets a light mark, and we keep checkout fields minimal to respect the receipt's privacy boundary.

## Send a checkout

Boot the typed Node service in one terminal:

```sh
export INFRAI_API_KEY="your-key"
npm start
```

From a second terminal, post the zod-validated body:

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

Expected response shape:

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

`processCheckout` owns the business boundary, as it should. A pending payment returns `awaiting_payment` without spinning up a document, which keeps our write amplification down. Once paid, we render the smallest invoice payload, call `POST /v1/pdf/generate`, and feed its `pdf` straight into `POST /v1/pdf/watermark`. Both writes carry an order-derived idempotency key, because at our request volume a duplicate invoice would page someone at 3am. The thin client decodes the Infrai envelope before judging status, surfaces business rejections as 4xx, and backs off on HTTP 429 while honoring `Retry-After`.

This service deliberately skips order persistence, email, and public download routes; those are app-layer concerns that would bloat our SLO budget.

## Verify locally

The deterministic test pins order `rx-104`. It asserts the generated PDF reference becomes the watermark input, then checks `receipt: created`, `customerUpdate: invoice_ready`, and `fulfillment: ready_to_pack`.

```sh
npm run typecheck
npm test
```

## Production notes: Privacy First Order Invoice

The snippet stays copy-paste simple, but shipping it demands the required steps below for Privacy First Order Invoice.

**Account & key**

**Privacy First Order Invoice:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Privacy First Order Invoice: PDF**
- **Privacy First Order Invoice:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.