import { JSONPath } from 'jsonpath-plus';
import type { Expect } from '../types/index.js';

export interface ComparatorResult {
  comparator: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  error?: string;
}

export function evaluateExpect(
  body: unknown,
  expectation: Expect,
): ComparatorResult {
  const matches = JSONPath({
    path: expectation.json_path,
    json: body as object,
    wrap: true,
  }) as unknown[];

  const actual =
    matches.length === 0
      ? undefined
      : matches.length === 1
        ? matches[0]
        : matches;

  if (expectation.exists !== undefined) {
    const passed = expectation.exists ? matches.length > 0 : matches.length === 0;
    return {
      comparator: 'exists',
      expected: expectation.exists,
      actual: matches.length > 0,
      passed,
    };
  }
  if (expectation.equals !== undefined) {
    return {
      comparator: 'equals',
      expected: expectation.equals,
      actual,
      passed: deepEqual(actual, expectation.equals),
    };
  }
  if (expectation.not_equals !== undefined) {
    return {
      comparator: 'not_equals',
      expected: expectation.not_equals,
      actual,
      passed: !deepEqual(actual, expectation.not_equals),
    };
  }
  if (expectation.contains !== undefined) {
    return {
      comparator: 'contains',
      expected: expectation.contains,
      actual,
      passed: containsValue(actual, expectation.contains),
    };
  }
  if (expectation.gte !== undefined) {
    return {
      comparator: 'gte',
      expected: expectation.gte,
      actual,
      passed: typeof actual === 'number' && actual >= expectation.gte,
    };
  }
  if (expectation.lte !== undefined) {
    return {
      comparator: 'lte',
      expected: expectation.lte,
      actual,
      passed: typeof actual === 'number' && actual <= expectation.lte,
    };
  }
  return {
    comparator: 'unknown',
    expected: undefined,
    actual,
    passed: false,
    error: 'no comparator specified',
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    return ak.every((k) =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return false;
}

function containsValue(haystack: unknown, needle: unknown): boolean {
  if (typeof haystack === 'string' && typeof needle === 'string') {
    return haystack.includes(needle);
  }
  if (Array.isArray(haystack)) {
    return haystack.some((v) => deepEqual(v, needle));
  }
  return false;
}
