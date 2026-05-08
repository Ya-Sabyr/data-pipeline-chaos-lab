import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { parseScenario, loadScenario } from '../src/runner/scenario.js';

describe('parseScenario', () => {
  it('accepts a valid minimal scenario', () => {
    const result = parseScenario({
      name: 'demo',
      target: { webhook_path: '/wh' },
      events: [{ name: 'e1', delay_ms: 0, body: { foo: 1 } }],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects when name is missing', () => {
    const result = parseScenario({
      target: { webhook_path: '/wh' },
      events: [{ name: 'e1', delay_ms: 0, body: {} }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an expect block with no comparator', () => {
    const result = parseScenario({
      name: 'demo',
      target: { webhook_path: '/wh' },
      events: [{ name: 'e1', delay_ms: 0, body: {} }],
      checks: {
        requests: [
          {
            name: 'c1',
            method: 'GET',
            path: '/x',
            expect: { json_path: '$.foo' },
          },
        ],
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects empty events array', () => {
    const result = parseScenario({
      name: 'demo',
      target: { webhook_path: '/wh' },
      events: [],
    });
    expect(result.ok).toBe(false);
  });
});

describe('loadScenario fixtures', () => {
  const fixtures = [
    'scenarios/duplicate_payment_event.yaml',
    'scenarios/delayed_payment_event.yaml',
    'scenarios/out_of_order_payment_event.yaml',
    'scenarios/replay_backfill_event.yaml',
  ];
  for (const file of fixtures) {
    it(`loads ${file}`, () => {
      const s = loadScenario(resolve(file));
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.events.length).toBeGreaterThan(0);
      expect(s.target.webhook_path.startsWith('/')).toBe(true);
    });
  }
});
