# Architecture

## High-level

```
+-----------------+         HTTP+JSON         +---------------------+
|    chaoslab     |  -- setup requests   -->  |                     |
|  CLI (Node 20)  |  -- webhook events   -->  |  YOUR BACKEND       |
|                 |  -- check requests   -->  |  (any language)     |
|  YAML scenarios |  <-- responses --         |                     |
+-----------------+                            +---------------------+
        |
        v
   Report (human or JSON)
```

The CLI is implemented in TypeScript on Node.js 20. **That choice is internal.** Users of the tool never read or write TypeScript; they author YAML, run a binary (or a Docker image), and read a report.

## Components

| Layer            | Module                          | Responsibility                                                       |
| ---------------- | ------------------------------- | -------------------------------------------------------------------- |
| Entrypoint       | `src/cli.ts`                    | Commander wiring for `run` and `validate`.                           |
| Scenario parser  | `src/runner/scenario.ts`        | YAML -> Zod -> typed `Scenario`. Friendly error messages.            |
| Orchestrator     | `src/runner/runner.ts`          | Setup -> events (with delays) -> checks. Computes reliability score. |
| HTTP client      | `src/http/client.ts`            | `fetch` wrapper with per-request timeout.                            |
| Checks           | `src/checks/checks.ts`          | Issues check requests, runs `expect` blocks against responses.       |
| JSONPath         | `src/checks/jsonpath.ts`        | `equals` / `not_equals` / `contains` / `exists` / `gte` / `lte`.     |
| Reporting        | `src/report/formatters.ts`      | Human (chalk) and JSON formatters.                                   |
| Type contract    | `src/types/index.ts`            | Single source of truth for `Scenario`, `Report`, etc.                |

## Runner phases

For `--mode full`:

1. **Load** — read the YAML, parse via Zod. Friendly errors include the YAML field path (`events.0.body`) and the schema rule that failed.
2. **Setup** — execute every `setup.requests` entry sequentially. If one returns non-2xx, the run aborts as `FAIL` and remaining phases are skipped. Setup state lives entirely on your backend (chaoslab is stateless).
3. **Events** — for each event, sleep `delay_ms` then issue the request. Events default to `POST` against `target.webhook_path`, but may override `method` and `path` (this is how out-of-order scenarios interleave invoice creation with webhook delivery).
4. **Checks** — for each check request, hit the path, run the `expect` block against the JSON response body. A check fails if the path returns no match, the comparator mismatches, or the request itself returned a non-2xx status.
5. **Report** — assemble `Report`, compute reliability score, format as human text or JSON.

For `--mode generic`, only steps 1, 3, and 5 run. Setup and checks are skipped. This is the right mode for backends that do not expose `/invoices` or `/events` endpoints.

## Reliability score

- `full` mode with checks: `passed_checks / total_checks * 100`.
- Otherwise: `ok_events / total_events * 100`.

Rounded to an integer.

## Result determination

| Mode    | Has checks? | Result rule                                     |
| ------- | ----------- | ----------------------------------------------- |
| full    | yes         | PASS iff every check passed.                    |
| full    | no          | PASS iff every event returned 2xx.              |
| generic | n/a         | PASS iff every event returned 2xx.              |

Process exit code: `0` on PASS, `1` on FAIL, `2` on configuration error (bad YAML, bad CLI args).

## Why YAML + JSONPath + HTTP

- **YAML** — human-readable, diff-friendly, easy to author by hand or generate from templates.
- **JSONPath** — standard syntax that most engineers recognize; non-Solana-specific.
- **HTTP** — every backend can speak it. No SDK, no protobuf, no language binding to drift.

The intersection of those three is the entire user-facing surface. Everything else (the TypeScript runner, Zod schemas, the chalk formatter) is implementation detail.

## Stateless by design

chaoslab does not persist anything between runs. State lives on your backend. To reset state between scenarios, hit your backend's reset endpoint (the example backends expose `POST /admin/reset`). In CI, prefer ephemeral databases per scenario over reset endpoints.
