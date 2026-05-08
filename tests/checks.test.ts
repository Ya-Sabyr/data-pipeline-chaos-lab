import { describe, it, expect } from 'vitest';
import { evaluateExpect } from '../src/checks/jsonpath.js';

describe('evaluateExpect', () => {
  it('equals on simple field', () => {
    const r = evaluateExpect(
      { status: 'paid' },
      { json_path: '$.status', equals: 'paid' },
    );
    expect(r.passed).toBe(true);
    expect(r.comparator).toBe('equals');
    expect(r.actual).toBe('paid');
  });

  it('equals fails on mismatch', () => {
    const r = evaluateExpect(
      { status: 'pending' },
      { json_path: '$.status', equals: 'paid' },
    );
    expect(r.passed).toBe(false);
    expect(r.actual).toBe('pending');
  });

  it('equals on numeric field', () => {
    const r = evaluateExpect(
      { count: 1 },
      { json_path: '$.count', equals: 1 },
    );
    expect(r.passed).toBe(true);
  });

  it('exists positive', () => {
    const r = evaluateExpect({ a: 1 }, { json_path: '$.a', exists: true });
    expect(r.passed).toBe(true);
  });

  it('exists negative', () => {
    const r = evaluateExpect({ a: 1 }, { json_path: '$.b', exists: false });
    expect(r.passed).toBe(true);
  });

  it('not_equals', () => {
    const r = evaluateExpect(
      { status: 'paid' },
      { json_path: '$.status', not_equals: 'pending' },
    );
    expect(r.passed).toBe(true);
  });

  it('contains in array', () => {
    const r = evaluateExpect(
      { tags: ['a', 'b'] },
      { json_path: '$.tags', contains: 'a' },
    );
    expect(r.passed).toBe(true);
  });

  it('contains in string', () => {
    const r = evaluateExpect(
      { msg: 'hello world' },
      { json_path: '$.msg', contains: 'world' },
    );
    expect(r.passed).toBe(true);
  });

  it('gte numeric', () => {
    const r = evaluateExpect({ n: 5 }, { json_path: '$.n', gte: 3 });
    expect(r.passed).toBe(true);
  });

  it('gte fails when below', () => {
    const r = evaluateExpect({ n: 1 }, { json_path: '$.n', gte: 3 });
    expect(r.passed).toBe(false);
  });

  it('lte numeric', () => {
    const r = evaluateExpect({ n: 2 }, { json_path: '$.n', lte: 3 });
    expect(r.passed).toBe(true);
  });

  it('handles nested path', () => {
    const r = evaluateExpect(
      { summary: { duplicate_events: 1 } },
      { json_path: '$.summary.duplicate_events', equals: 1 },
    );
    expect(r.passed).toBe(true);
  });
});
