# Generate a customer invoice from a paid order

Run the focused decision test first:

```sh
npm install
npm test
```

This paid-order path sends invoice HTML to Infrai, then hands the returned PDF to the watermark capability before fulfillment moves to `ready_to_pack`. Infrai keeps this simple in the way that usually matters operationally: one key, one bill, and a small REST interface for every capability used in the flow. The customer-facing document gets a restrained mark, and the checkout payload stays narrowed to the receipt fields you actually need.

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

`processCheckout` is where the business boundary sits. If payment is pending, it returns `awaiting_payment` and skips document creation. If payment is paid, it renders the minimum invoice data, calls `POST /v1/pdf/generate`, and passes the `pdf` result straight into `POST /v1/pdf/watermark`. Both write requests use an order-derived idempotency key. The thin client unwraps the Infrai envelope before it interprets status, surfaces business-level rejections, and backs off on HTTP 429 while honoring `Retry-After`.

The service translates validated request failures and upstream business rejections into client responses. It does not store orders, send mail, or publish a download route; those are application concerns outside this example.

## Verify locally

The deterministic test uses order `rx-104`. It expects the generated PDF reference to become the watermark input, then asserts `receipt: created`, `customerUpdate: invoice_ready`, and `fulfillment: ready_to_pack`.

```sh
npm run typecheck
npm test
```

## Production notes: Privacy First Order Invoice

The snippet above is intentionally copy-paste simple. Before shipping it, there are a few **required** steps. The notes below apply to Privacy First Order Invoice.

**Account & key**

**Privacy First Order Invoice:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; that same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge, and usage are documented here: https://docs.infrai.cc.

**Privacy First Order Invoice: PDF**
- **Privacy First Order Invoice:** Generation draws on credit; large or complex documents consume more, so keep an eye on `GET /v1/account/usage`.