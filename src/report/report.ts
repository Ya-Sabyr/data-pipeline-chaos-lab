import type { Report } from '../types/index.js';

export function isPass(report: Report): boolean {
  return report.result === 'PASS';
}

export function exitCode(report: Report): number {
  return report.result === 'PASS' ? 0 : 1;
}
