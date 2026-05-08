#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exampleDir = resolve(repoRoot, 'examples', 'node-express-backend');
const cliPath = resolve(repoRoot, 'dist', 'cli.js');
const PORT = Number(process.env.CHAOSLAB_DEMO_PORT ?? 3000);
const TARGET = `http://localhost:${PORT}`;

if (!existsSync(resolve(exampleDir, 'node_modules'))) {
  console.log('[demo:node] installing example backend dependencies...');
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: exampleDir,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('[demo:node] npm install failed for example backend');
    process.exit(1);
  }
}

if (!existsSync(cliPath)) {
  console.log('[demo:node] building chaoslab CLI...');
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('[demo:node] chaoslab build failed');
    process.exit(1);
  }
}

console.log(`[demo:node] starting Node Express example backend on :${PORT}...`);
const server = spawn('npx', ['tsx', 'src/server.ts'], {
  cwd: exampleDir,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, PORT: String(PORT) },
  detached: true,
});

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

async function waitForReady(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not ready yet
    }
    await wait(200);
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
  console.log('[demo:node] backend ready.');

  let allPass = true;
  for (const sc of scenarios) {
    process.stdout.write('\n');
    console.log(`[demo:node] resetting backend state and running ${sc}`);
    await fetch(`${TARGET}/admin/reset`, { method: 'POST' });
    const r = spawnSync(
      'node',
      [cliPath, 'run', sc, '--target', TARGET, '--mode', 'full'],
      { stdio: 'inherit', cwd: repoRoot },
    );
    if (r.status !== 0) {
      allPass = false;
      console.log(`[demo:node] ${sc} -> FAIL`);
    }
  }

  cleanup();
  console.log(
    `\n[demo:node] all scenarios ${allPass ? 'PASSED against the Node Express backend' : 'did not all pass'}.`,
  );
  process.exit(allPass ? 0 : 1);
} catch (err) {
  console.error('[demo:node] error:', err instanceof Error ? err.message : err);
  cleanup();
  process.exit(1);
}
