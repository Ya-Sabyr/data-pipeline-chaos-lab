#!/usr/bin/env node
import { Command } from 'commander';
import { loadScenario } from './runner/scenario.js';
import { runScenario } from './runner/runner.js';
import { formatHuman, formatJson } from './report/formatters.js';
import { exitCode } from './report/report.js';
import type { Mode } from './types/index.js';

const program = new Command();

program
  .name('chaoslab')
  .description(
    'Language-agnostic chaos and reliability testing CLI for Solana event-driven backends.',
  )
  .version('0.1.0');

interface RunOpts {
  target: string;
  mode: string;
  json: boolean;
  timeoutMs: number;
  verbose: boolean;
}

program
  .command('run')
  .argument('<scenario>', 'path to a scenario YAML file')
  .description('Run a scenario YAML against a target backend over HTTP')
  .requiredOption('--target <url>', 'base URL of the target backend')
  .option('--mode <mode>', "'generic' or 'full'", 'generic')
  .option('--json', 'output report as JSON instead of human text', false)
  .option(
    '--timeout-ms <ms>',
    'per-request timeout in milliseconds',
    (v) => Number.parseInt(v, 10),
    10000,
  )
  .option('--verbose', 'verbose output (currently a no-op placeholder)', false)
  .action(async (scenarioPath: string, opts: RunOpts) => {
    if (opts.mode !== 'generic' && opts.mode !== 'full') {
      console.error(
        `error: --mode must be 'generic' or 'full', got '${opts.mode}'`,
      );
      process.exit(2);
    }
    let scenario;
    try {
      scenario = loadScenario(scenarioPath);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(2);
    }
    const report = await runScenario(scenario, {
      target: opts.target,
      mode: opts.mode as Mode,
      json: opts.json,
      timeoutMs: opts.timeoutMs,
      verbose: opts.verbose,
    });
    if (opts.json) {
      process.stdout.write(formatJson(report) + '\n');
    } else {
      process.stdout.write(formatHuman(report) + '\n');
    }
    process.exit(exitCode(report));
  });

program
  .command('validate')
  .argument('<scenario>', 'path to a scenario YAML file')
  .description('Validate a scenario YAML file against the schema')
  .action((scenarioPath: string) => {
    try {
      const scenario = loadScenario(scenarioPath);
      const numChecks = scenario.checks?.requests.length ?? 0;
      const numSetup = scenario.setup?.requests.length ?? 0;
      console.log(
        `OK: ${scenarioPath} (scenario "${scenario.name}", ${scenario.events.length} events, ${numSetup} setup requests, ${numChecks} checks)`,
      );
      process.exit(0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
