import type { HttpMethod, HttpResult } from '../types/index.js';

export interface RequestOptions {
  baseUrl: string;
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs: number;
}

export async function httpRequest(opts: RequestOptions): Promise<HttpResult> {
  const url = joinUrl(opts.baseUrl, opts.path);
  const started = performance.now();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json',
    'user-agent': 'chaoslab/0.1.0',
    ...opts.headers,
  };
  const init: RequestInit = {
    method: opts.method,
    headers,
    signal: AbortSignal.timeout(opts.timeoutMs),
  };
  if (
    opts.body !== undefined &&
    opts.method !== 'GET' &&
    opts.method !== 'DELETE'
  ) {
    init.body = JSON.stringify(opts.body);
  }
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const latencyMs = Math.round(performance.now() - started);
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return {
      status: res.status,
      body: parsed,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    return {
      status: 0,
      body: null,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const tail = path.startsWith('/') ? path : `/${path}`;
  return `${base}${tail}`;
}
