import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { runScenario } from '../src/runner/runner.js';
import type { Scenario } from '../src/types/index.js';

let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => (err ? reject(err) : resolve()));
    });
    server = null;
  }
});

type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;

async function startServer(handler: Handler): Promise<string> {
  return new Promise((resolveBase) => {
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        handler(req, res, body);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (addr === null || typeof addr === 'string') {
        throw new Error('unexpected listen address');
      }
      resolveBase(`http://127.0.0.1:${addr.port}`);
    });
  });
}

describe('runScenario generic mode', () => {
  it('sends each event as POST to the webhook path and returns PASS on 2xx', async () => {
    const seen: { path: string | undefined; body: unknown }[] = [];
    const baseUrl = await startServer((req, res, body) => {
      seen.push({ path: req.url, body: body.length > 0 ? JSON.parse(body) : null });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });

    const scenario: Scenario = {
      name: 'test_dup',
      target: { webhook_path: '/webhooks/solana' },
      events: [
        { name: 'e1', delay_ms: 0, body: { tx_signature: 'a' } },
        { name: 'e2', delay_ms: 10, body: { tx_signature: 'a' } },
      ],
    };

    const report = await runScenario(scenario, {
      target: baseUrl,
      mode: 'generic',
      json: false,
      timeoutMs: 5000,
      verbose: false,
    });

    expect(report.result).toBe('PASS');
    expect(report.events).toHaveLength(2);
    expect(seen).toHaveLength(2);
    expect(seen[0]!.path).toBe('/webhooks/solana');
    expect(seen[0]!.body).toMatchObject({ tx_signature: 'a' });
  });

  it('marks FAIL when an event returns 5xx', async () => {
    const baseUrl = await startServer((_req, res) => {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end('{"error":"boom"}');
    });

    const scenario: Scenario = {
      name: 'test_fail',
      target: { webhook_path: '/wh' },
      events: [{ name: 'e1', delay_ms: 0, body: {} }],
    };

    const report = await runScenario(scenario, {
      target: baseUrl,
      mode: 'generic',
      json: false,
      timeoutMs: 5000,
      verbose: false,
    });

    expect(report.result).toBe('FAIL');
    expect(report.reliability_score).toBe(0);
  });

  it('respects per-event delay_ms ordering', async () => {
    const timestamps: number[] = [];
    const baseUrl = await startServer((_req, res) => {
      timestamps.push(performance.now());
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });

    const scenario: Scenario = {
      name: 'test_delay',
      target: { webhook_path: '/wh' },
      events: [
        { name: 'e1', delay_ms: 0, body: {} },
        { name: 'e2', delay_ms: 100, body: {} },
      ],
    };

    await runScenario(scenario, {
      target: baseUrl,
      mode: 'generic',
      json: false,
      timeoutMs: 5000,
      verbose: false,
    });

    expect(timestamps).toHaveLength(2);
    const gap = timestamps[1]! - timestamps[0]!;
    expect(gap).toBeGreaterThanOrEqual(80);
  });
});

describe('runScenario full mode', () => {
  it('runs setup, events, and checks; returns PASS when all checks pass', async () => {
    const state = { invoice_paid: false, events_received: 0 };
    const baseUrl = await startServer((req, res, body) => {
      const url = req.url ?? '';
      if (url === '/invoices' && req.method === 'POST') {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end('{"invoice_id":"inv_x","status":"pending"}');
        return;
      }
      if (url === '/wh' && req.method === 'POST') {
        state.events_received += 1;
        if (!state.invoice_paid) state.invoice_paid = true;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"processed":true}');
        return;
      }
      if (url === '/invoices/inv_x' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ invoice_id: 'inv_x', status: state.invoice_paid ? 'paid' : 'pending' }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const scenario: Scenario = {
      name: 'test_full',
      target: { webhook_path: '/wh' },
      setup: {
        requests: [
          { name: 'create', method: 'POST', path: '/invoices', body: { invoice_id: 'inv_x' } },
        ],
      },
      events: [{ name: 'pay', delay_ms: 0, body: { tx_signature: 't1' } }],
      checks: {
        requests: [
          {
            name: 'paid',
            method: 'GET',
            path: '/invoices/inv_x',
            expect: { json_path: '$.status', equals: 'paid' },
          },
        ],
      },
    };

    const report = await runScenario(scenario, {
      target: baseUrl,
      mode: 'full',
      json: false,
      timeoutMs: 5000,
      verbose: false,
    });

    expect(report.result).toBe('PASS');
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0]!.passed).toBe(true);
    expect(report.reliability_score).toBe(100);
  });
});
