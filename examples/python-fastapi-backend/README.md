# Python FastAPI Example Backend

A minimal reference backend in Python + FastAPI that demonstrates the same HTTP contract as the Node Express example. The two backends are functionally interchangeable from chaoslab's point of view — the same scenarios pass against both.

This is **not** the chaoslab CLI itself. It's a sample backend you would replace with your own implementation.

## Endpoints

Identical to the Node example:

| Method | Path                       |
| ------ | -------------------------- |
| GET    | `/health`                  |
| POST   | `/invoices`                |
| GET    | `/invoices/{invoice_id}`   |
| POST   | `/webhooks/solana`         |
| GET    | `/events`                  |
| GET    | `/events/summary`          |
| POST   | `/admin/reset`             |

## Run it

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 3001
```

Then from the repo root:

```bash
npm run dev -- run scenarios/duplicate_payment_event.yaml \
  --target http://localhost:3001 --mode full
```

Or run all four scenarios in one shot:

```bash
npm run demo:python
```

If port 3001 is already in use, run the demo from the repo root with another port:

```bash
CHAOSLAB_DEMO_PORT=3101 npm run demo:python
```

## Why a Python mirror exists

To prove the language-agnostic claim. Cloning this file in Go, Rust, Java, or any other stack should produce a backend that passes the same scenarios with the same reports.
