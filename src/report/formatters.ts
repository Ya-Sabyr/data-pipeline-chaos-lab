import chalk from 'chalk';
import type { Report } from '../types/index.js';

export function formatJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

export function formatHuman(report: Report): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(chalk.bold('Solana Data Pipeline Chaos Lab Report'));
  lines.push('');
  lines.push(`Scenario: ${chalk.cyan(report.scenario)}`);
  if (report.description) {
    lines.push(`Description: ${report.description}`);
  }
  lines.push(`Target: ${report.target}`);
  lines.push(`Mode: ${report.mode}`);
  const resultStyled =
    report.result === 'PASS'
      ? chalk.green.bold(report.result)
      : chalk.red.bold(report.result);
  lines.push(`Result: ${resultStyled}`);
  lines.push(`Reliability score: ${report.reliability_score}%`);
  lines.push(`Duration: ${report.duration_ms} ms`);

  if (report.setup.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Setup:'));
    for (const s of report.setup) {
      const tag = s.ok ? chalk.green('PASS') : chalk.red('FAIL');
      const detail = s.error ? ` - ${s.error}` : '';
      lines.push(
        `  - ${s.name} (${s.method} ${s.path}) -> ${s.status} (${s.latencyMs} ms) ${tag}${detail}`,
      );
    }
  }

  if (report.events.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Events:'));
    for (const e of report.events) {
      const tag = e.ok ? chalk.green('OK') : chalk.red('FAIL');
      const detail = e.error ? ` - ${e.error}` : '';
      lines.push(
        `  - ${e.name} (${e.method} ${e.path}) -> ${e.status} (${e.latencyMs} ms) ${tag}${detail}`,
      );
    }
  }

  if (report.checks.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Checks:'));
    for (const ch of report.checks) {
      const tag = ch.passed ? chalk.green('PASS') : chalk.red('FAIL');
      const detail = ch.error
        ? ` - ${ch.error}`
        : ` (${ch.json_path} ${ch.comparator} ${formatValue(ch.expected)}; got ${formatValue(ch.actual)})`;
      lines.push(`  - ${ch.name}: ${tag}${detail}`);
    }
  }

  if (report.failure_modes_tested.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Failure modes tested:'));
    for (const m of report.failure_modes_tested) {
      lines.push(`  - ${m}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function formatValue(v: unknown): string {
  if (v === undefined) return 'undefined';
  return JSON.stringify(v);
}
