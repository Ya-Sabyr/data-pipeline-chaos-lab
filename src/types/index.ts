export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Mode = 'generic' | 'full';

export interface SetupRequest {
  name?: string;
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ScenarioEvent {
  name: string;
  delay_ms: number;
  method?: HttpMethod;
  path?: string;
  body: unknown;
  headers?: Record<string, string>;
}

export interface Expect {
  json_path: string;
  equals?: unknown;
  not_equals?: unknown;
  contains?: unknown;
  exists?: boolean;
  gte?: number;
  lte?: number;
}

export interface CheckRequest {
  name: string;
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  expect: Expect;
}

export interface Scenario {
  name: string;
  description?: string;
  failure_modes?: string[];
  target: { webhook_path: string };
  setup?: { requests: SetupRequest[] };
  events: ScenarioEvent[];
  checks?: { requests: CheckRequest[] };
}

export interface RunOptions {
  target: string;
  mode: Mode;
  json: boolean;
  timeoutMs: number;
  verbose: boolean;
}

export interface HttpResult {
  status: number;
  body: unknown;
  latencyMs: number;
  error?: string;
}

export interface SetupResult {
  name: string;
  method: HttpMethod;
  path: string;
  status: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

export interface EventResult {
  name: string;
  method: HttpMethod;
  path: string;
  status: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

export interface CheckResult {
  name: string;
  method: HttpMethod;
  path: string;
  comparator: string;
  json_path: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  error?: string;
}

export interface Report {
  report_version: '1';
  scenario: string;
  description?: string;
  target: string;
  mode: Mode;
  result: 'PASS' | 'FAIL';
  reliability_score: number;
  failure_modes_tested: string[];
  setup: SetupResult[];
  events: EventResult[];
  checks: CheckResult[];
  duration_ms: number;
  started_at: string;
  finished_at: string;
}
