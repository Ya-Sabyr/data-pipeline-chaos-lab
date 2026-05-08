import type {
  CheckRequest,
  CheckResult,
  RunOptions,
} from '../types/index.js';
import { httpRequest } from '../http/client.js';
import { evaluateExpect } from './jsonpath.js';

export async function runChecks(
  requests: CheckRequest[],
  opts: RunOptions,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const req of requests) {
    const res = await httpRequest({
      baseUrl: opts.target,
      method: req.method,
      path: req.path,
      body: req.body,
      headers: req.headers,
      timeoutMs: opts.timeoutMs,
    });
    if (res.error || res.status === 0) {
      results.push({
        name: req.name,
        method: req.method,
        path: req.path,
        comparator: 'http',
        json_path: req.expect.json_path,
        expected: undefined,
        actual: undefined,
        passed: false,
        error: res.error ?? `request failed (status ${res.status})`,
      });
      continue;
    }
    if (res.status >= 400) {
      results.push({
        name: req.name,
        method: req.method,
        path: req.path,
        comparator: 'http',
        json_path: req.expect.json_path,
        expected: '2xx/3xx',
        actual: res.status,
        passed: false,
        error: `non-success status ${res.status}`,
      });
      continue;
    }
    const evalRes = evaluateExpect(res.body, req.expect);
    results.push({
      name: req.name,
      method: req.method,
      path: req.path,
      comparator: evalRes.comparator,
      json_path: req.expect.json_path,
      expected: evalRes.expected,
      actual: evalRes.actual,
      passed: evalRes.passed,
      error: evalRes.error,
    });
  }
  return results;
}
