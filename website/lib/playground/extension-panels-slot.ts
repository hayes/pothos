/**
 * Side-channel for examples that need to push playground panels from
 * deep inside a query's execution path — where threading the panel
 * back through the GraphQL response's `extensions.playgroundPanels`
 * isn't practical. The classic case: an ORM-level middleware records
 * each emitted SQL statement; it has no handle on the GraphQL result
 * object, so it appends to this slot instead.
 *
 * The query runner resets the slot before every run and reads it
 * back after the operation finishes, merging captured panels with any
 * the schema surfaced explicitly via `extensions.playgroundPanels`.
 *
 * Module-level state is safe here: the playground runs one operation
 * at a time (single-threaded browser, no concurrent invocations).
 */

'use client';

import type { ExtensionPanel } from './playground-panels';

let panels: ExtensionPanel[] = [];

export function resetExtensionPanels(): void {
  panels = [];
}

export function pushExtensionPanel(panel: ExtensionPanel): void {
  panels.push(panel);
}

export function getExtensionPanels(): readonly ExtensionPanel[] {
  return panels;
}
