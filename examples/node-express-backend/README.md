# Node.js Express Example Backend

A minimal reference backend in Node.js + Express that demonstrates the HTTP contract Solana Data Pipeline Chaos Lab tests. It is **not** the chaoslab CLI itself — it is a sample backend you would replace with your own implementation in any language.

## Endpoints

| Method | Path                       | Purpose                                                  |
| ------ | -------------------------- | -------------------------------------------------------- |
| GET    | `/health`                  | Liveness check.                                          |
| POST   | `/invoices`                | Create an invoice with `pending` status.                 |
| GET    | `/invoices/:invoice_id`    | Fetch invoice or 404.                                    |
| POST   | `/webhooks/solana`         | Idempotent Solana payment webhook handler.               |
| GET    | `/events`                  | List all events (raw, in receive order).                 |
| GET    | `/events/summary`          | Aggregate counts: processed, duplicate, ignored, total.  |
| POST   | `/admin/reset`             | Clear in-memory state (used by the demo runner).         |

## Run it

```bash
npm install
npm start          # listens on http://localhost:3000
```

Then from the repo root:

```bash
npm run dev -- run scenarios/duplicate_payment_event.yaml \
  --target http://localhost:3000 --mode full
```

Or run all four scenarios in one shot:

```bash
npm run demo:node
```

## What it demonstrates

- **Idempotency by `tx_signature`**: a second event with the same signature is recorded as a duplicate.
- **Graceful out-of-order handling**: events whose invoice does not exist yet are recorded as `ignored`, never crash, and never silently lose data.
- **Single source of truth for invoice status**: `pending` -> `paid` only on the first successful event.

## Translate to your stack

This whole file is under 150 lines for a reason. Rewrite it in Python (FastAPI), Go (chi), Rust (axum), Java (Spring Boot), or anything else — chaoslab does not care, it only speaks HTTP and JSON.
