#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exampleDir = resolve(repoRoot, 'examples', 'python-fastapi-backend');
const cliPath = resolve(repoRoot, 'dist', 'cli.js');
const PORT = Number(process.env.CHAOSLAB_DEMO_PORT ?? 3001);
const TARGET = `http://localhost:${PORT}`;

function pickPython() {
  for (const candidate of ['python3', 'python']) {
    const r = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (r.status === 0) return candidate;
  }
  return null;
}

const python = pickPython();
if (!python) {
  console.error(
    '[demo:python] could not find python3 on PATH; install Python 3.10+ and retry',
  );
  process.exit(1);
}

const venvDir = resolve(exampleDir, '.venv');
const venvPython =
  platform() === 'win32'
    ? resolve(venvDir, 'Scripts', 'python.exe')
    : resolve(venvDir, 'bin', 'python');

if (!existsSync(venvPython)) {
  console.log('[demo:python] creating virtualenv at examples/python-fastapi-backend/.venv');
  const r = spawnSync(python, ['-m', 'venv', venvDir], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('[demo:python] failed to create venv');
    process.exit(1);
  }
}

console.log('[demo:python] installing example backend dependencies into venv');
const installRes = spawnSync(
  venvPython,
  ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', '-r', 'requirements.txt'],
  { cwd: exampleDir, stdio: 'inherit' },
);
if (installRes.status !== 0) {
  console.error('[demo:python] pip install failed');
  process.exit(1);
}

if (!existsSync(cliPath)) {
  console.log('[demo:python] building chaoslab CLI...');
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('[demo:python] chaoslab build failed');
    process.exit(1);
  }
}

console.log(`[demo:python] starting FastAPI backend on :${PORT}...`);
const server = spawn(
  venvPython,
  ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(PORT), '--log-level', 'warning'],
  {
    cwd: exampleDir,
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  },
);

let cleanedUp = false;
const cleanup = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  if (server.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // already gone
    }
    setTimeout(() => {
      try {
        process.kill(-server.pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }, 800).unref();
  }
};
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

async function waitForReady(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not ready
    }
    await wait(250);
  }
  throw new Error(`server at ${url} did not become ready within ${timeoutMs} ms`);
}

const scenarios = [
  'scenarios/duplicate_payment_event.yaml',
  'scenarios/delayed_payment_event.yaml',
  'scenarios/out_of_order_payment_event.yaml',
  'scenarios/replay_backfill_event.yaml',
];

try {
  await waitForReady(`${TARGET}/health`);
  console.log('[demo:python] backend ready.');

  let allPass = true;
  for (const sc of scenarios) {
    process.stdout.write('\n');
    console.log(`[demo:python] resetting backend state and running ${sc}`);
    await fetch(`${TARGET}/admin/reset`, { method: 'POST' });
    const r = spawnSync(
      'node',
      [cliPath, 'run', sc, '--target', TARGET, '--mode', 'full'],
      { stdio: 'inherit', cwd: repoRoot },
    );
    if (r.status !== 0) {
      allPass = false;
      console.log(`[demo:python] ${sc} -> FAIL`);
    }
  }

  cleanup();
  console.log(
    `\n[demo:python] all scenarios ${allPass ? 'PASSED against the FastAPI backend' : 'did not all pass'}.`,
  );
  process.exit(allPass ? 0 : 1);
} catch (err) {
  console.error('[demo:python] error:', err instanceof Error ? err.message : err);
  cleanup();
  process.exit(1);
}
