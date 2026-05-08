# Changelog

All notable changes to `solana-chaoslab` will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-05-08

### Added
- `chaoslab` / `solana-chaoslab` CLI with `run` and `validate` subcommands.
- Generic and full execution modes; human-readable and JSON reports.
- JSONPath comparators: `equals`, `not_equals`, `contains`, `exists`, `gte`, `lte`.
- Four shipped scenarios: `duplicate_payment_event`, `delayed_payment_event`, `out_of_order_payment_event`, `replay_backfill_event`.
- Reference Node.js + Express and Python + FastAPI example backends.
- Docker and `docker-compose.yml` demo stack.
- Vitest test suite (27 tests covering scenario parsing, runner, checks, formatting).
- Documentation: README, proposal, architecture, scenario format, example reports.

[Unreleased]: https://github.com/Ya-Sabyr/data-pipeline-chaos-lab/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Ya-Sabyr/data-pipeline-chaos-lab/releases/tag/v0.1.0
