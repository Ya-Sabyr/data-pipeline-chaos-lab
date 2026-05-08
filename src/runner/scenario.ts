import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { Scenario } from '../types/index.js';

const httpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

const expectSchema = z
  .object({
    json_path: z.string().min(1),
    equals: z.unknown().optional(),
    not_equals: z.unknown().optional(),
    contains: z.unknown().optional(),
    exists: z.boolean().optional(),
    gte: z.number().optional(),
    lte: z.number().optional(),
  })
  .refine(
    (v) =>
      v.equals !== undefined ||
      v.not_equals !== undefined ||
      v.contains !== undefined ||
      v.exists !== undefined ||
      v.gte !== undefined ||
      v.lte !== undefined,
    {
      message:
        "expect must include at least one comparator: equals, not_equals, contains, exists, gte, or lte",
    },
  );

const setupRequestSchema = z.object({
  name: z.string().optional(),
  method: httpMethod,
  path: z.string().min(1),
  body: z.unknown().optional(),
  headers: z.record(z.string()).optional(),
});

const scenarioEventSchema = z.object({
  name: z.string().min(1),
  delay_ms: z.number().nonnegative().default(0),
  method: httpMethod.optional(),
  path: z.string().optional(),
  body: z.unknown(),
  headers: z.record(z.string()).optional(),
});

const checkRequestSchema = z.object({
  name: z.string().min(1),
  method: httpMethod,
  path: z.string().min(1),
  body: z.unknown().optional(),
  headers: z.record(z.string()).optional(),
  expect: expectSchema,
});

const scenarioSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  failure_modes: z.array(z.string()).optional(),
  target: z.object({
    webhook_path: z.string().min(1),
  }),
  setup: z
    .object({
      requests: z.array(setupRequestSchema),
    })
    .optional(),
  events: z.array(scenarioEventSchema).min(1),
  checks: z
    .object({
      requests: z.array(checkRequestSchema),
    })
    .optional(),
});

export type ScenarioParseResult =
  | { ok: true; scenario: Scenario }
  | { ok: false; errors: string[] };

export function parseScenario(raw: unknown): ScenarioParseResult {
  const parsed = scenarioSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join('.') || '<root>'}: ${i.message}`,
      ),
    };
  }
  return { ok: true, scenario: parsed.data as Scenario };
}

export function loadScenario(path: string): Scenario {
  const abs = resolve(path);
  const text = readFileSync(abs, 'utf8');
  const raw = parseYaml(text);
  const result = parseScenario(raw);
  if (!result.ok) {
    const msg = result.errors.map((e) => ` - ${e}`).join('\n');
    throw new Error(`Scenario file ${path} is invalid:\n${msg}`);
  }
  return result.scenario;
}
