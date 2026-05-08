import { describe, it, expect, beforeAll } from 'vitest';
import chalk from 'chalk';
import { formatHuman, formatJson } from '../src/report/formatters.js';
import type { Report } from '../src/types/index.js';

beforeAll(() => {
  chalk.level = 0;
});

const sample: Report = {
  report_version: '1',
  scenario: 'demo',
  description: 'demo scenario',
  target: 'http://localhost:3000',
  mode: 'full',
  result: 'PASS',
  reliability_score: 100,
  failure_modes_tested: ['duplicate event delivery'],
  setup: [
    {
      name: 'create_invoice',
      method: 'POST',
      path: '/invoices',
      status: 201,
      latencyMs: 3,
      ok: true,
    },
  ],
  events: [
    {
      name: 'e1',
      method: 'POST',
      path: '/wh',
      status: 200,
      latencyMs: 5,
      ok: true,
    },
  ],
  checks: [
    {
      name: 'c1',
      method: 'GET',
      path: '/x',
      comparator: 'equals',
      json_path: '$.status',
      expected: 'paid',
      actual: 'paid',
      passed: true,
    },
  ],
  duration_ms: 100,
  started_at: '2026-01-01T00:00:00.000Z',
  finished_at: '2026-01-01T00:00:00.100Z',
};

describe('formatJson', () => {
  it('produces valid JSON with stable shape', () => {
    const text = formatJson(sample);
    const parsed = JSON.parse(text);
    expect(parsed.report_version).toBe('1');
    expect(parsed.result).toBe('PASS');
    expect(parsed.checks[0].passed).toBe(true);
    expect(parsed.reliability_score).toBe(100);
  });
});

describe('formatHuman', () => {
  it('contains key sections', () => {
    const text = formatHuman(sample);
    expect(text).toContain('Solana Data Pipeline Chaos Lab Report');
    expect(text).toContain('Scenario: demo');
    expect(text).toContain('PASS');
    expect(text).toContain('Failure modes tested');
    expect(text).toContain('duplicate event delivery');
    expect(text).toContain('Reliability score: 100%');
  });

  it('shows FAIL prominently when result is FAIL', () => {
    const failReport: Report = {
      ...sample,
      result: 'FAIL',
      reliability_score: 50,
      checks: [
        {
          ...sample.checks[0]!,
          passed: false,
          actual: 'pending',
        },
      ],
    };
    const text = formatHuman(failReport);
    expect(text).toContain('FAIL');
    expect(text).toContain('Reliability score: 50%');
  });
});
