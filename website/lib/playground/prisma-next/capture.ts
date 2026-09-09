/**
 * Module-level capture slot for the prisma-next playground demo.
 *
 * On each `graphql()` run the playground harness calls `resetCapture()`,
 * user code's `@prisma-next/sqlite` runtime is configured with the
 * capture middleware (see `capture-middleware.ts`), and the runner reads
 * `getCapturedPanels()` after the operation finishes to attach the SQL
 * + orm-intent tabs to the response's `extensions`.
 *
 * Browser-only — no AsyncLocalStorage. Concurrent runs aren't possible
 * (the playground runs one operation per click), so a flat slot is
 * sufficient. Multiple SQL plans within a run are appended in execution
 * order; cross-resolver grouping isn't attempted.
 */
import type { ExtensionPanel } from '../playground-panels';

export interface CapturedSql {
  /** Formatted SQL text. */
  sql: string;
  /** Bound parameters. */
  params: unknown[];
  /** Wallclock latency, if the runtime reported one. */
  latencyMs?: number;
  /** Distilled orm-intent (verb + table + where/include tree). */
  intent: Record<string, unknown> | null;
  /** Verb derived from the AST / SQL — for the sub-tab label. */
  label: string;
}

let captures: CapturedSql[] = [];

export function resetCapture(): void {
  captures = [];
}

export function pushCapture(entry: CapturedSql): void {
  captures.push(entry);
}

export function getCaptures(): readonly CapturedSql[] {
  return captures;
}

/**
 * Build the `extensions.playgroundPanels` entries for the current run.
 * Returns an array with one top-level panel per kind (SQL / ORM intent),
 * each carrying sub-tabs — one sub-tab per captured plan in execution
 * order.
 */
export function getCapturedPanels(): ExtensionPanel[] {
  if (captures.length === 0) {
    return [];
  }

  const sqlTabs = captures.map((cap, i) => ({
    name: `${i + 1}. ${cap.label}`,
    language: 'sql' as const,
    content: renderSqlBody(cap),
  }));

  const intentTabs = captures.map((cap, i) => ({
    name: `${i + 1}. ${cap.label}`,
    language: 'json' as const,
    content: JSON.stringify(cap.intent ?? {}, null, 2),
  }));

  return [
    { name: 'SQL', tabs: sqlTabs },
    { name: 'Prisma query AST', tabs: intentTabs },
  ];
}

function renderSqlBody(cap: CapturedSql): string {
  const header =
    typeof cap.latencyMs === 'number' ? `-- ${cap.label} · ${cap.latencyMs.toFixed(1)} ms\n` : '';
  const params = cap.params.length > 0 ? `\n\n-- params: ${JSON.stringify(cap.params)}` : '';
  return `${header}${cap.sql.trim()}${params}`;
}
