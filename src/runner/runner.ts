import type {
  CheckResult,
  EventResult,
  Report,
  RunOptions,
  Scenario,
  SetupResult,
} from '../types/index.js';
import { httpRequest } from '../http/client.js';
import { runChecks } from '../checks/checks.js';
import { sleep } from './delays.js';

export async function runScenario(
  scenario: Scenario,
  opts: RunOptions,
): Promise<Report> {
  const startedAtIso = new Date().toISOString();
  const startedAt = performance.now();

  const setupResults: SetupResult[] = [];
  const eventResults: EventResult[] = [];
  const checkResults: CheckResult[] = [];

  if (opts.mode === 'full' && scenario.setup) {
    for (const req of scenario.setup.requests) {
      const res = await httpRequest({
        baseUrl: opts.target,
        method: req.method,
        path: req.path,
        body: req.body,
        headers: req.headers,
        timeoutMs: opts.timeoutMs,
      });
      const ok = res.status >= 200 && res.status < 300;
      setupResults.push({
        name: req.name ?? `${req.method} ${req.path}`,
        method: req.method,
        path: req.path,
        status: res.status,
        latencyMs: res.latencyMs,
        ok,
        error: res.error,
      });
      if (!ok) {
        return finalize({
          scenario,
          opts,
          setupResults,
          eventResults,
          checkResults,
          startedAtIso,
          startedAt,
          earlyAbort: true,
        });
      }
    }
  }

  for (const event of scenario.events) {
    if (event.delay_ms > 0) await sleep(event.delay_ms);
    const path = event.path ?? scenario.target.webhook_path;
    const method = event.method ?? 'POST';
    const res = await httpRequest({
      baseUrl: opts.target,
      method,
      path,
      body: event.body,
      headers: event.headers,
      timeoutMs: opts.timeoutMs,
    });
    eventResults.push({
      name: event.name,
      method,
      path,
      status: res.status,
      latencyMs: res.latencyMs,
      ok: res.status >= 200 && res.status < 300,
      error: res.error,
    });
  }

  if (opts.mode === 'full' && scenario.checks) {
    const results = await runChecks(scenario.checks.requests, opts);
    checkResults.push(...results);
  }

  return finalize({
    scenario,
    opts,
    setupResults,
    eventResults,
    checkResults,
    startedAtIso,
    startedAt,
    earlyAbort: false,
  });
}

interface FinalizeArgs {
  scenario: Scenario;
  opts: RunOptions;
  setupResults: SetupResult[];
  eventResults: EventResult[];
  checkResults: CheckResult[];
  startedAtIso: string;
  startedAt: number;
  earlyAbort: boolean;
}

function finalize(args: FinalizeArgs): Report {
  const finishedAtIso = new Date().toISOString();
  const durationMs = Math.round(performance.now() - args.startedAt);

  const reliability = computeReliability(args);
  const result = computeResult(args);

  return {
    report_version: '1',
    scenario: args.scenario.name,
    description: args.scenario.description,
    target: args.opts.target,
    mode: args.opts.mode,
    result,
    reliability_score: reliability,
    failure_modes_tested: args.scenario.failure_modes ?? [],
    setup: args.setupResults,
    events: args.eventResults,
    checks: args.checkResults,
    duration_ms: durationMs,
    started_at: args.startedAtIso,
    finished_at: finishedAtIso,
  };
}

function computeReliability(args: FinalizeArgs): number {
  if (args.opts.mode === 'full' && args.checkResults.length > 0) {
    const passed = args.checkResults.filter((c) => c.passed).length;
    return Math.round((passed / args.checkResults.length) * 100);
  }
  if (args.eventResults.length === 0) return 0;
  const ok = args.eventResults.filter((e) => e.ok).length;
  return Math.round((ok / args.eventResults.length) * 100);
}

function computeResult(args: FinalizeArgs): 'PASS' | 'FAIL' {
  if (args.earlyAbort) return 'FAIL';
  if (args.opts.mode === 'full' && args.checkResults.length > 0) {
    return args.checkResults.every((c) => c.passed) ? 'PASS' : 'FAIL';
  }
  return args.eventResults.every((e) => e.ok) ? 'PASS' : 'FAIL';
}
