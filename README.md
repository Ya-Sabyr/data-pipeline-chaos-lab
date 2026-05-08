# Solana Data Pipeline Chaos Lab

> Open-source, language-agnostic CLI for chaos and reliability testing of Solana event-driven backends — webhooks, indexer consumers, RPC subscribers.

[![status](https://img.shields.io/badge/status-V0-blue)]() [![license](https://img.shields.io/badge/license-MIT-green)]()

---

## Table of contents

1. [What is this?](#1-what-is-this)
2. [Why Solana backends need reliability testing](#2-why-solana-backends-need-reliability-testing)
3. [The five failure modes this tool exercises](#3-the-five-failure-modes-this-tool-exercises)
4. [Why idempotency by `tx_signature` matters](#4-why-idempotency-by-tx_signature-matters)
5. [Language-agnostic by design](#5-language-agnostic-by-design)
6. [No TypeScript knowledge required](#6-no-typescript-knowledge-required)
7. [Quickstart with Node.js](#7-quickstart-with-nodejs)
8. [Quickstart with Docker](#8-quickstart-with-docker)
9. [Test a Node.js backend](#9-test-a-nodejs-backend)
10. [Test a Python FastAPI backend](#10-test-a-python-fastapi-backend)
11. [Test any custom backend](#11-test-any-custom-backend)
12. [Scenario YAML format](#12-scenario-yaml-format)
13. [Report examples](#13-report-examples)
14. [Roadmap](#14-roadmap)
15. [Grant proof-of-work](#15-grant-proof-of-work)

---

## 1. What is this?

Solana Data Pipeline Chaos Lab is a small CLI named `chaoslab` that **replays realistic Solana event-delivery failures** against your backend over plain HTTP. You describe scenarios in YAML, run the CLI, and get a pass/fail report with a reliability score.

It does not care what language your backend is written in. It does not require an SDK. It does not require a Solana RPC connection. It is a **black-box reliability test harness** for any HTTP service that consumes Solana-style events.

## 2. Why Solana backends need reliability testing

Most Solana applications listen for on-chain events through a webhook provider, a custom indexer, or RPC subscriptions. In production, the event stream is not clean:

- **Duplicates.** Providers retry on timeout. Indexers republish on restart.
- **Late delivery.** A network blip causes a webhook to arrive minutes late.
- **Out-of-order delivery.** Slot rollbacks and parallel pipelines reorder events.
- **Missed + replayed events.** Backfills push historical events through your live pipeline.
- **Partial failures.** Your provider's failover delivers half the batch, then redelivers.

If your backend does not handle these correctly, the visible bugs are bad: **double-counted payments, invoices stuck in `pending`, NFT ownership mis-attributed, leaderboards wrong, analytics off.** And these bugs almost never appear in local development, because local tests use clean single-pass streams.

## 3. The five failure modes this tool exercises

V0 ships scenarios for the four most common Solana webhook bugs:

| Scenario file                            | Failure mode                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `duplicate_payment_event.yaml`           | Same `tx_signature` delivered twice; backend must dedupe.                 |
| `delayed_payment_event.yaml`             | Webhook arrives 2 s after the originating tx; invoice must still be paid. |
| `out_of_order_payment_event.yaml`        | Payment arrives before its invoice; backend must not crash, must reconcile after backfill. |
| `replay_backfill_event.yaml`             | Historical event replayed after the original; backend must detect replay, must not double-pay. |

A fifth (chain reorg / slot rollback) is on the [roadmap](#14-roadmap).

## 4. Why idempotency by `tx_signature` matters

`tx_signature` is the canonical Solana transaction identifier. It is unique per confirmed transaction and stable across replays. **It is the right key for webhook idempotency.**

A correct backend stores the `tx_signature` of every processed event and rejects any subsequent event carrying a `tx_signature` it has already seen. Backends that key off internal `event_id`, timestamps, or invoice IDs will eventually double-count.

The `duplicate_payment_event` and `replay_backfill_event` scenarios are designed specifically to catch backends that key off the wrong field.

## 5. Language-agnostic by design

The user-facing surface is:

- **CLI** — one binary (or one Docker image)
- **YAML** — scenario format, hand-editable
- **HTTP + JSON** — the only protocol it speaks to your backend
- **JSON or human reports** — for CI consumption or eyeballing

There is no client SDK, no language binding, no schema generator. **Your backend can be written in TypeScript, Python, Go, Rust, Java, Elixir, PHP, or anything else.** chaoslab tests it identically.

This repository ships two reference backends, in **Node.js + Express** and **Python + FastAPI**, that are functionally equivalent. The same scenarios pass against both. That's the language-agnostic claim, demonstrated.

## 6. No TypeScript knowledge required

The CLI is implemented in TypeScript on Node.js 20+. **That choice is internal.** Users do not read or write TypeScript. They author YAML, run a binary, and read a report.

If you would rather not have Node on your machine at all, [skip to the Docker quickstart](#8-quickstart-with-docker).

## 7. Quickstart with Node.js

Requires Node.js 20+.

```bash
git clone https://github.com/<your-org>/solana-data-pipeline-chaos-lab.git
cd solana-data-pipeline-chaos-lab
npm install

# Generic mode: just send the events. Useful for any backend.
npm run dev -- run scenarios/duplicate_payment_event.yaml \
  --target http://localhost:3000 --mode generic

# Full mode: setup + events + state checks. Requires invoice/event endpoints.
npm run dev -- run scenarios/duplicate_payment_event.yaml \
  --target http://localhost:3000 --mode full

# CI-friendly JSON output
npm run dev -- run scenarios/duplicate_payment_event.yaml \
  --target http://localhost:3000 --mode full --json

# Validate a scenario file without running it
npm run dev -- validate scenarios/duplicate_payment_event.yaml
```

Exit codes: `0` PASS, `1` FAIL, `2` configuration error.

## 8. Quickstart with Docker

No Node, no Python, no installs.

```bash
docker compose up --build chaoslab node-backend
```

This brings up the reference Node backend on port 3000 and runs the duplicate-payment scenario against it. To run a different scenario:

```bash
docker compose run --rm chaoslab \
  run /app/scenarios/replay_backfill_event.yaml \
  --target http://node-backend:3000 --mode full
```

To run against the Python reference backend instead:

```bash
docker compose run --rm chaoslab \
  run /app/scenarios/replay_backfill_event.yaml \
  --target http://python-backend:3001 --mode full
```

For a published image (once available) without compose:

```bash
docker run --rm -v "$(pwd)/scenarios:/app/scenarios:ro" \
  ghcr.io/<your-org>/chaoslab \
  run /app/scenarios/duplicate_payment_event.yaml \
  --target http://host.docker.internal:3000 --mode full
```

## 9. Test a Node.js backend

The repo includes `examples/node-express-backend/` — a minimal Express + TypeScript backend in ~150 lines that demonstrates the HTTP contract. Run all four scenarios against it with:

```bash
npm run demo:node
```

Expected output: every scenario reports `Result: PASS` and `Reliability score: 100%`.

To wire up your own Node backend, just expose the [endpoints listed below](#11-test-any-custom-backend) and point chaoslab at its base URL.

## 10. Test a Python FastAPI backend

The repo includes `examples/python-fastapi-backend/` — a Python + FastAPI mirror of the Node backend.

```bash
npm run demo:python
```

(The script auto-creates a `.venv` and installs deps on first run.) Expected output: identical PASS results to the Node demo, proving the language-agnostic claim.

## 11. Test any custom backend

The CLI assumes only one required endpoint:

| Method | Path                | Purpose                                        |
| ------ | ------------------- | ---------------------------------------------- |
| POST   | `/webhooks/solana`  | Receives Solana event payloads.                |

(You can change the path via `target.webhook_path` in any scenario.)

For `--mode full`, the CLI additionally hits these optional endpoints:

| Method | Path                       | Purpose                                                  |
| ------ | -------------------------- | -------------------------------------------------------- |
| POST   | `/invoices`                | Setup: create an invoice in `pending` status.            |
| GET    | `/invoices/{invoice_id}`   | Check: read invoice status (`paid` / `pending`).         |
| GET    | `/events/summary`          | Check: aggregate counts (`processed_events`, `duplicate_events`, `ignored_events`, `total_events`). |
| GET    | `/events`                  | Optional: full event list.                               |
| GET    | `/health`                  | Optional: liveness check.                                |

Implement those endpoints in your stack of choice, point `--target` at your base URL, and you are done. **No code from this repo runs inside your backend.**

## 12. Scenario YAML format

See [docs/scenario_format.md](docs/scenario_format.md) for the full reference.

Minimal example:

```yaml
name: duplicate_payment_event
target:
  webhook_path: /webhooks/solana
events:
  - name: first
    delay_ms: 0
    body:
      tx_signature: tx_abc
      invoice_id: inv_001
      amount: 10.0
  - name: duplicate
    delay_ms: 500
    body:
      tx_signature: tx_abc
      invoice_id: inv_001
      amount: 10.0
checks:
  requests:
    - name: invoice_paid
      method: GET
      path: /invoices/inv_001
      expect:
        json_path: $.status
        equals: paid
```

Comparators: `equals`, `not_equals`, `contains`, `exists`, `gte`, `lte`. JSONPath syntax is `jsonpath-plus`.

## 13. Report examples

See [docs/example_report.md](docs/example_report.md) for full samples in both formats.

Human (default):

```
Result: PASS
Reliability score: 100%

Checks:
  - invoice_should_be_paid: PASS ($.status equals "paid"; got "paid")
  - should_have_one_duplicate_event: PASS ($.duplicate_events equals 1; got 1)

Failure modes tested:
  - duplicate event delivery
  - idempotency by tx_signature
  - no double-counting
```

JSON (`--json`):

```json
{
  "report_version": "1",
  "result": "PASS",
  "reliability_score": 100,
  "failure_modes_tested": ["duplicate event delivery", "idempotency by tx_signature"],
  "checks": [{"name": "invoice_should_be_paid", "passed": true, "expected": "paid", "actual": "paid"}]
}
```

## 14. Roadmap

V0 (this milestone): walking skeleton, four scenarios, generic + full modes, JSON + human reports, two reference backends, Docker demo, full docs.

Planned next:

- Real Solana RPC integration (replay actual mainnet/devnet transactions).
- Chain reorg / slot rollback scenario.
- More example backends: Rust (axum), Go (chi), Java (Spring Boot).
- Network chaos primitives (jitter distributions, retry storms, packet loss).
- Severity-weighted reliability score.
- HTML / Markdown report formatters for PR comments.
- Watch / streaming mode for staging-environment fuzzing.
- npm publish as `solana-chaoslab` (so `npx solana-chaoslab` works without a checkout).
- CI templates: GitHub Actions, GitLab CI.
- VS Code extension for scenario authoring.

See [docs/proposal.md](docs/proposal.md) for the full grant-track plan.

## 15. Grant proof-of-work

This repository is the V0 deliverable for a Solana ecosystem grant focused on **public-good reliability infrastructure**. It is positioned for the Solana ecosystem, not for one specific runtime.

Grant reviewers can verify the V0 in under five minutes:

```bash
git clone <repo>
cd solana-data-pipeline-chaos-lab
npm install
npm test                 # unit tests pass
npm run demo:node        # all 4 scenarios PASS against Node backend
npm run demo:python      # all 4 scenarios PASS against Python backend
docker compose up --build chaoslab node-backend  # PASS in container
```

For full positioning, motivation, deliverables, and budget: [docs/proposal.md](docs/proposal.md).

---

## Architecture

See [docs/architecture.md](docs/architecture.md).

## Tests

```bash
npm test
```

## License

MIT.
