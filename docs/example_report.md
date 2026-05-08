# Example Reports

Both formats are produced from the same `Report` object. Use `--json` to switch.

## Human-readable (default)

```
Solana Data Pipeline Chaos Lab Report

Scenario: duplicate_payment_event
Description: Sends the same Solana payment event twice. The backend must process it only once and detect the second copy as a duplicate.
Target: http://localhost:3000
Mode: full
Result: PASS
Reliability score: 100%
Duration: 554 ms

Setup:
  - create_invoice (POST /invoices) -> 201 (40 ms) PASS

Events:
  - first_payment_event (POST /webhooks/solana) -> 200 (3 ms) OK
  - duplicate_payment_event (POST /webhooks/solana) -> 200 (4 ms) OK

Checks:
  - invoice_should_be_paid: PASS ($.status equals "paid"; got "paid")
  - should_have_one_duplicate_event: PASS ($.duplicate_events equals 1; got 1)

Failure modes tested:
  - duplicate event delivery
  - idempotency by tx_signature
  - no double-counting
```

## JSON (`--json`)

```json
{
  "report_version": "1",
  "scenario": "duplicate_payment_event",
  "description": "Sends the same Solana payment event twice. The backend must process it only once and detect the second copy as a duplicate.",
  "target": "http://localhost:3000",
  "mode": "full",
  "result": "PASS",
  "reliability_score": 100,
  "failure_modes_tested": [
    "duplicate event delivery",
    "idempotency by tx_signature",
    "no double-counting"
  ],
  "setup": [
    {
      "name": "create_invoice",
      "method": "POST",
      "path": "/invoices",
      "status": 201,
      "latencyMs": 40,
      "ok": true
    }
  ],
  "events": [
    {
      "name": "first_payment_event",
      "method": "POST",
      "path": "/webhooks/solana",
      "status": 200,
      "latencyMs": 3,
      "ok": true
    },
    {
      "name": "duplicate_payment_event",
      "method": "POST",
      "path": "/webhooks/solana",
      "status": 200,
      "latencyMs": 4,
      "ok": true
    }
  ],
  "checks": [
    {
      "name": "invoice_should_be_paid",
      "method": "GET",
      "path": "/invoices/inv_001",
      "comparator": "equals",
      "json_path": "$.status",
      "expected": "paid",
      "actual": "paid",
      "passed": true
    },
    {
      "name": "should_have_one_duplicate_event",
      "method": "GET",
      "path": "/events/summary",
      "comparator": "equals",
      "json_path": "$.duplicate_events",
      "expected": 1,
      "actual": 1,
      "passed": true
    }
  ],
  "duration_ms": 554,
  "started_at": "2026-05-08T21:35:18.123Z",
  "finished_at": "2026-05-08T21:35:18.677Z"
}
```

## Field semantics

| Field                  | Notes                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| `report_version`       | Bumped on any breaking JSON shape change. V0 ships `"1"`.             |
| `result`               | `"PASS"` or `"FAIL"`. Maps to process exit code 0 or 1.               |
| `reliability_score`    | 0-100 integer. Definition in [architecture.md](./architecture.md).    |
| `failure_modes_tested` | Verbatim from the YAML's `failure_modes` list.                        |
| `setup` / `events`     | One entry per request actually issued, in order.                      |
| `checks`               | One entry per check request. `passed` is the single source of truth.  |
| `latencyMs`            | Round-trip time for that one request.                                 |

## Failure example

```json
{
  "result": "FAIL",
  "reliability_score": 50,
  "checks": [
    {
      "name": "invoice_should_be_paid",
      "passed": false,
      "comparator": "equals",
      "json_path": "$.status",
      "expected": "paid",
      "actual": "pending"
    },
    {
      "name": "should_have_one_duplicate_event",
      "passed": true,
      "expected": 1,
      "actual": 1
    }
  ]
}
```

The `actual` field is the value chaoslab observed; pair it with the human report (which prints the request that produced it) to localize the bug.
