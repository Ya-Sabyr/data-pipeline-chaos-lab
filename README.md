# solana-chaoslab

> Chaos and reliability testing for Solana event-driven backends.

[![CI](https://github.com/Ya-Sabyr/data-pipeline-chaos-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/Ya-Sabyr/data-pipeline-chaos-lab/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/solana-chaoslab.svg?logo=npm)](https://www.npmjs.com/package/solana-chaoslab)
[![node](https://img.shields.io/node/v/solana-chaoslab.svg?logo=node.js)](https://www.npmjs.com/package/solana-chaoslab)
[![license](https://img.shields.io/npm/l/solana-chaoslab.svg)](./LICENSE)
[![provenance](https://img.shields.io/badge/npm-provenance-blue?logo=github)](https://docs.npmjs.com/generating-provenance-statements)

`solana-chaoslab` replays realistic event-delivery failures — duplicates, late events, out-of-order, replay/backfill — against any HTTP backend you point it at. Describe scenarios in YAML, run a single command, get a pass/fail report with a reliability score.

Your backend can be written in **any language**. The CLI only speaks HTTP and JSON. No SDK, no client library, no Solana RPC connection required.

```bash
npx solana-chaoslab run my-scenario.yaml --target http://localhost:3000 --mode full
```

## Install

```bash
# One-shot, no install
npx solana-chaoslab --help

# Globally
npm install -g solana-chaoslab
chaoslab --version

# Per-project (recommended for CI)
npm install --save-dev solana-chaoslab
```

Requires **Node.js 20+**. The published binary is named both `chaoslab` (short) and `solana-chaoslab` (unambiguous).

## Quick start

```bash
# 1. Grab a sample scenario
curl -O https://raw.githubusercontent.com/Ya-Sabyr/data-pipeline-chaos-lab/main/scenarios/duplicate_payment_event.yaml

# 2. Validate the YAML
npx solana-chaoslab validate duplicate_payment_event.yaml

# 3. Run it against your backend
npx solana-chaoslab run duplicate_payment_event.yaml \
  --target http://localhost:3000 --mode full
```

Sample output:

```
Solana Data Pipeline Chaos Lab Report

Scenario: duplicate_payment_event
Target:   http://localhost:3000
Mode:     full
Result:   PASS
Reliability score: 100%

Checks:
  - invoice_should_be_paid: PASS  ($.status equals "paid"; got "paid")
  - should_have_one_duplicate_event: PASS  ($.duplicate_events equals 1; got 1)

Failure modes tested:
  - duplicate event delivery
  - idempotency by tx_signature
  - no double-counting
```

## Features

- **Language-agnostic** — TypeScript, Python, Go, Rust, Java, Elixir, anything that speaks HTTP.
- **YAML scenarios** — hand-editable, diff-friendly, no code required.
- **Two execution modes** — `--mode generic` just sends events; `--mode full` runs setup, events, and state checks.
- **JSONPath assertions** — `equals`, `not_equals`, `contains`, `exists`, `gte`, `lte`.
- **CI-friendly reports** — human text by default, JSON via `--json`. Exit codes: `0` PASS, `1` FAIL, `2` config error.
- **Docker-ready** — run without installing Node at all.
- **Provenance-signed** — published to npm with verifiable [build attestations](https://docs.npmjs.com/generating-provenance-statements) from GitHub Actions.

## Failure modes covered

| Scenario                          | What it tests                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `duplicate_payment_event`         | Same `tx_signature` delivered twice — backend must dedupe.                     |
| `delayed_payment_event`           | Webhook arrives 2 s after the originating tx — invoice must still become paid. |
| `out_of_order_payment_event`      | Payment arrives before its invoice — backend must reconcile after backfill.    |
| `replay_backfill_event`           | Historical event replayed after the original — backend must not double-pay.    |

More scenarios on the [roadmap](#roadmap).

## How it works

```
+-----------------+         HTTP + JSON         +----------------------+
|   chaoslab      |  --- setup requests   --->  |                      |
|   (Node CLI)    |  --- webhook events   --->  |   YOUR BACKEND       |
|                 |  --- check requests   --->  |   (any language)     |
|  YAML scenarios |  <-- responses ---          |                      |
+-----------------+                             +----------------------+
        |
        v
   Report (human or JSON, plus exit code)
```

The CLI is implemented in TypeScript on Node.js — **you never read or write TypeScript**. You author YAML, run a binary, read a report.

## Required HTTP contract

The CLI assumes one required endpoint on your backend:

| Method | Path                | Purpose                          |
| ------ | ------------------- | -------------------------------- |
| POST   | `/webhooks/solana`  | Receives event payloads.         |

(You can change the path via `target.webhook_path` in any scenario.)

For `--mode full`, the CLI additionally calls these optional endpoints:

| Method | Path                       |
| ------ | -------------------------- |
| POST   | `/invoices`                |
| GET    | `/invoices/{invoice_id}`   |
| GET    | `/events`                  |
| GET    | `/events/summary`          |
| GET    | `/health`                  |

Implement any subset that matches your test goals.

## CLI reference

```
chaoslab run <scenario.yaml> [options]
  --target <url>            base URL of the target backend (required)
  --mode generic|full       generic = events only, full = setup + events + checks (default: generic)
  --json                    emit JSON report instead of human text
  --timeout-ms <ms>         per-request timeout in milliseconds (default: 10000)
  --verbose                 verbose output

chaoslab validate <scenario.yaml>
  Schema-checks the YAML; non-zero exit on invalid input.

chaoslab --version
chaoslab --help
```

## Run with Docker

No Node, no Python, no installs:

```bash
git clone https://github.com/Ya-Sabyr/data-pipeline-chaos-lab.git
cd data-pipeline-chaos-lab
docker compose up --build chaoslab node-backend
```

This brings up the reference Node backend on port 3000 and runs the duplicate-payment scenario against it. Swap `node-backend` for `python-backend` to verify the language-agnostic claim end-to-end.

## Examples

The repo ships two reference backends that demonstrate the HTTP contract — both pass all four shipped scenarios:

- [`examples/node-express-backend`](examples/node-express-backend) — Node.js + Express, ~150 lines.
- [`examples/python-fastapi-backend`](examples/python-fastapi-backend) — Python + FastAPI, same API.

Try them after cloning:

```bash
npm install
npm run demo:node      # all 4 scenarios PASS against Node backend
npm run demo:python    # all 4 scenarios PASS against Python backend (auto-creates venv)
```

## Documentation

- [Scenario YAML format](docs/scenario_format.md) — full field reference and comparator catalog.
- [Architecture](docs/architecture.md) — runner phases, score computation, design notes.
- [Example reports](docs/example_report.md) — human and JSON output side by side.
- [Project proposal](docs/proposal.md) — motivation, public-good positioning, milestones.

## Roadmap

- Real Solana RPC integration (replay actual mainnet/devnet transactions).
- Chain reorg / slot rollback scenario.
- More reference backends: Rust (axum), Go (chi), Java (Spring Boot).
- Network chaos primitives (jitter distributions, retry storms, packet loss).
- Severity-weighted reliability score with critical/warning tiers.
- HTML / Markdown report formatters for PR comments.
- `chaoslab init` to scaffold example scenarios.
- Watch / streaming mode for staging fuzzing.
- GitHub Actions and GitLab CI templates.
- VS Code extension.

See [docs/proposal.md](docs/proposal.md) for the full plan.

## Contributing

Bug reports, scenario contributions, and example backends in new languages are all welcome.

```bash
git clone https://github.com/Ya-Sabyr/data-pipeline-chaos-lab.git
cd data-pipeline-chaos-lab
npm install
npm test
```

New scenarios are just YAML — they don't require touching TypeScript at all. Drop one in `scenarios/`, add a test that loads it, open a PR.

For maintainers cutting releases, see [RELEASING.md](RELEASING.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © Ya-Sabyr
