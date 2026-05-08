# Scenario YAML Format

A scenario is a single YAML file that describes a sequence of HTTP interactions and post-conditions. The format is **independent of any language or runtime**.

## Top-level fields

```yaml
name: duplicate_payment_event              # required, unique identifier
description: ...                           # optional, free text shown in reports
failure_modes:                             # optional, listed under "Failure modes tested"
  - duplicate event delivery
  - idempotency by tx_signature

target:                                    # required
  webhook_path: /webhooks/solana

setup:                                     # optional, run only in --mode full
  requests:
    - ...                                  # see "Setup request" below

events:                                    # required, at least one
  - ...                                    # see "Event" below

checks:                                    # optional, run only in --mode full
  requests:
    - ...                                  # see "Check request" below
```

## `target.webhook_path`

The default path used for events that do not override it. Most scenarios POST every event to this single path, but events may override it (see below).

## Setup request

```yaml
setup:
  requests:
    - name: create_invoice           # optional, used in reports
      method: POST                   # GET | POST | PUT | PATCH | DELETE
      path: /invoices                # path on the target backend
      body:                          # optional, serialized as JSON
        invoice_id: inv_001
        wallet_address: fake_solana_wallet
        expected_amount: 10.0
        token_mint: USDC
      headers:                       # optional
        x-trace-id: abc
```

Setup requests run sequentially. If any returns a non-2xx status, the entire run aborts as `FAIL` (the backend was not in a state where the test could be meaningful).

## Event

```yaml
events:
  - name: first_payment_event        # required, used in reports
    delay_ms: 0                      # optional, default 0; sleep BEFORE this event
    method: POST                     # optional, default POST
    path: /webhooks/solana           # optional, default target.webhook_path
    body:                            # required (may be {} if your backend accepts empty bodies)
      event_id: evt_001
      tx_signature: tx_abc
      slot: 123456
      event_type: payment_received
      invoice_id: inv_001
      amount: 10.0
      token_mint: USDC
      timestamp: "2026-01-01T10:00:00Z"
    headers:                         # optional
      x-source: chaoslab-test
```

`events` is an ordered, on-the-wire list. The runner sleeps `delay_ms` before each event, then issues the request and waits for the response before moving on.

Even though the field is called `events`, an entry can issue any HTTP request. This is how out-of-order scenarios interleave invoice creation with webhook delivery.

## Check request

```yaml
checks:
  requests:
    - name: invoice_should_be_paid   # required
      method: GET                    # GET | POST | PUT | PATCH | DELETE
      path: /invoices/inv_001        # path on the target backend
      # body: ...                    # optional, serialized as JSON
      # headers: ...                 # optional string-valued headers
      expect:
        json_path: $.status          # JSONPath against the response body
        equals: paid                 # one of the comparators below
```

A check passes when the request returned 2xx **and** the JSONPath comparator passed.

## Comparator catalog

The schema requires at least one comparator per `expect` block. Keep scenarios to one comparator per check so reports stay unambiguous:

| Comparator   | Type            | Passes when ...                                                          |
| ------------ | --------------- | ------------------------------------------------------------------------ |
| `equals`     | any             | the JSONPath value deep-equals the given value.                          |
| `not_equals` | any             | the JSONPath value does NOT deep-equal the given value.                  |
| `contains`   | string or array | the value (string) contains the substring, or (array) contains the item. |
| `exists`     | boolean         | the JSONPath has at least one match (`true`) or zero matches (`false`).  |
| `gte`        | number          | the JSONPath value is a number `>=` the given value.                     |
| `lte`        | number          | the JSONPath value is a number `<=` the given value.                     |

The runner uses `jsonpath-plus` syntax. Common patterns:

```
$.status                  # top-level field
$.summary.duplicate_events # nested
$.events[0].outcome       # array index
$.events[?(@.outcome=='processed')]  # filter
```

## Validation

Run

```bash
npm run dev -- validate scenarios/your_scenario.yaml
```

The validator reports the YAML path and rule for any failure, such as a missing required field, an `expect` block without a supported comparator, or an empty events list.

## Versioning

The format is V0. Future incompatible changes will introduce a `version: 2` top-level field. V0 files are versionless.
