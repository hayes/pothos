/**
 * `SqlMiddleware` that records every executed SQL plan into the
 * playground capture slot. Adapted from the sibling
 * `pothos-prisma-next-demo` project (`src/prisma-next/db.ts`) — same
 * idea, but no `AsyncLocalStorage` (single-threaded browser) and no
 * `sql-formatter` (would pull a heavy dep into the playground bundle;
 * raw SQL is fine for now).
 *
 * Surface for user code in the playground steps:
 *
 *   import { capturePlaygroundSql } from '@pothos/playground-capture';
 *
 *   export const db = sqlite<Contract>({
 *     contractJson,
 *     path: 'seed:blog',
 *     middleware: [capturePlaygroundSql],
 *   });
 *
 * That's the entire wiring. The middleware pushes per-plan captures
 * into a module-level slot; `useQueryRunner` reads them after the
 * operation finishes and attaches them to `extensions.playgroundPanels`.
 */

import type { SqlMiddleware } from '@prisma-next/sql-runtime';
import { type CapturedSql, pushCapture } from './capture';

interface AstLike {
  kind?: string;
  from?: { kind?: string; table?: string; name?: string } | string;
  into?: { table?: string };
  table?: string;
}

const AST_NOISY_KEYS = new Set([
  'codec',
  'codecId',
  'sourceLocation',
  'meta',
  'parent',
  '_row',
  'storage',
  'descriptor',
]);

function walkAst(value: unknown, depth: number): unknown {
  if (depth > 20) {
    return '<…>';
  }
  if (value == null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => walkAst(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (AST_NOISY_KEYS.has(key)) {
      continue;
    }
    const v = (value as Record<string, unknown>)[key];
    if (v === undefined) {
      continue;
    }
    out[key] = walkAst(v, depth + 1);
  }
  return out;
}

function summarizeAst(ast: unknown): Record<string, unknown> | null {
  if (!ast || typeof ast !== 'object') {
    return null;
  }
  return walkAst(ast, 0) as Record<string, unknown>;
}

function primaryTableFromAst(ast: AstLike | null): string | undefined {
  if (!ast) {
    return undefined;
  }
  if (typeof ast.table === 'string') {
    return ast.table;
  }
  if (ast.into && typeof ast.into.table === 'string') {
    return ast.into.table;
  }
  if (ast.from) {
    if (typeof ast.from === 'string') {
      return ast.from;
    }
    if (typeof ast.from.table === 'string') {
      return ast.from.table;
    }
    if (typeof ast.from.name === 'string') {
      return ast.from.name;
    }
  }
  return undefined;
}

function labelFromAst(ast: unknown, sql: string): string {
  const node = ast as AstLike | null;
  if (node && typeof node.kind === 'string') {
    const table = primaryTableFromAst(node);
    return table ? `${node.kind} ${table}` : node.kind;
  }
  // Fall back to a SQL heuristic.
  const trimmed = sql.trim().replace(/\s+/g, ' ');
  const m = trimmed.match(/^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i);
  const verb = m ? m[1].toLowerCase() : trimmed.slice(0, 6).toLowerCase();
  const t =
    trimmed.match(/\bFROM\s+["`]?(\w+)["`]?/i) ??
    trimmed.match(/\bINTO\s+["`]?(\w+)["`]?/i) ??
    trimmed.match(/\bUPDATE\s+["`]?(\w+)["`]?/i);
  return t ? `${verb} ${t[1]}` : verb;
}

// `afterExecute` reports `latencyMs`; we need to patch it onto the
// matching capture entry. Plans are unique objects per execution, so a
// `WeakMap<plan, CapturedSql>` works as the join key without leaking
// strong references past the plan's lifetime.
const pendingByPlan = new WeakMap<object, CapturedSql>();

// The `SqlMiddleware` interface declares each hook as
// `() => Promise<void>`. The work is synchronous, so we explicitly
// return `Promise.resolve()` rather than tagging the methods `async`
// (which biome flags when there's no `await` inside).
export const capturePlaygroundSql: SqlMiddleware = {
  name: 'pothos-playground-capture',
  familyId: 'sql',
  beforeExecute(plan) {
    const entry: CapturedSql = {
      sql: plan.sql,
      params: [...plan.params],
      intent: summarizeAst(plan.ast),
      label: labelFromAst(plan.ast, plan.sql),
    };
    pushCapture(entry);
    pendingByPlan.set(plan as unknown as object, entry);
    return Promise.resolve();
  },
  afterExecute(plan, result) {
    const entry = pendingByPlan.get(plan as unknown as object);
    if (!entry) {
      return Promise.resolve();
    }
    pendingByPlan.delete(plan as unknown as object);
    if (typeof result.latencyMs === 'number') {
      entry.latencyMs = Math.round(result.latencyMs * 10) / 10;
    }
    return Promise.resolve();
  },
};
