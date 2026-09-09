/**
 * Capture sink for the prisma-next playground demo.
 *
 * Each executed SQL plan becomes one sub-tab in two response panels —
 * "SQL" (the lowered statement + params) and "Prisma query AST" (the
 * pre-lowering intent). The panels live in the playground's generic
 * extension-panel slot (`extension-panels-slot.ts`): the query runner
 * resets that slot before every run and reads it back afterwards, so
 * the first capture of a run pushes a fresh pair of panels and later
 * captures append tabs to them.
 *
 * Browser-only — no AsyncLocalStorage. Concurrent runs aren't possible
 * (the playground runs one operation per click), so module-level state
 * is sufficient. Multiple SQL plans within a run are appended in
 * execution order; cross-resolver grouping isn't attempted.
 */
import { getExtensionPanels, pushExtensionPanel } from '../extension-panels-slot';
import type { ExtensionPanel, ExtensionSubPanel } from '../playground-panels';

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

interface RunPanels {
  sql: ExtensionPanel & { tabs: ExtensionSubPanel[] };
  intent: ExtensionPanel & { tabs: ExtensionSubPanel[] };
}

let current: RunPanels | null = null;
const sqlTabByCapture = new WeakMap<CapturedSql, ExtensionSubPanel>();

/**
 * Return this run's panel pair, pushing a fresh pair into the slot if
 * the runner has reset it since the last capture (identity check —
 * a reset slot no longer contains our panel object).
 */
function panelsForRun(): RunPanels {
  if (current && getExtensionPanels().includes(current.sql)) {
    return current;
  }
  current = {
    sql: { name: 'SQL', tabs: [] },
    intent: { name: 'Prisma query AST', tabs: [] },
  };
  pushExtensionPanel(current.sql);
  pushExtensionPanel(current.intent);
  return current;
}

export function pushCapture(entry: CapturedSql): void {
  const panels = panelsForRun();
  const index = panels.sql.tabs.length + 1;
  const sqlTab: ExtensionSubPanel = {
    name: `${index}. ${entry.label}`,
    language: 'sql',
    content: renderSqlBody(entry),
  };
  panels.sql.tabs.push(sqlTab);
  panels.intent.tabs.push({
    name: `${index}. ${entry.label}`,
    language: 'json',
    content: JSON.stringify(entry.intent ?? {}, null, 2),
  });
  sqlTabByCapture.set(entry, sqlTab);
}

/** Re-render a capture's SQL tab after `afterExecute` reported latency. */
export function updateCapture(entry: CapturedSql): void {
  const tab = sqlTabByCapture.get(entry);
  if (tab) {
    tab.content = renderSqlBody(entry);
  }
}

function renderSqlBody(cap: CapturedSql): string {
  const header =
    typeof cap.latencyMs === 'number' ? `-- ${cap.label} · ${cap.latencyMs.toFixed(1)} ms\n` : '';
  const params = cap.params.length > 0 ? `\n\n-- params: ${JSON.stringify(cap.params)}` : '';
  return `${header}${cap.sql.trim()}${params}`;
}
