import type { ExampleMetadata } from '../examples';

/**
 * Display category labels (per design handoff) mapped to the
 * `category` field on ExampleMetadata.
 *
 *   Quickstarts ↔ core
 *   Plugins      ↔ plugins
 *   Patterns     ↔ patterns
 *   Recipes      ↔ examples (real-world recipes)
 *
 * Examples lacking a `category` are grouped under "More".
 */
export const DISPLAY_CATEGORIES = [
  { id: 'core', label: 'Quickstarts' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'examples', label: 'Recipes' },
] as const;

export type DisplayCategoryId = (typeof DISPLAY_CATEGORIES)[number]['id'];

export interface PickerGroup {
  id: DisplayCategoryId | 'more';
  label: string;
  items: ExampleMetadata[];
}

/**
 * Filter out generated sub-bundles — only show base examples in the
 * picker. Step bundles (`-step-N`) are reached via the StepperBar once
 * an example is loaded; definition-style variants (`-variant-<slug>`)
 * are reached via the docs style-switcher, so neither should appear as
 * a standalone picker entry.
 */
export function filterTopLevelExamples(all: readonly ExampleMetadata[]): ExampleMetadata[] {
  return all.filter((ex) => !/-step-\d+$/.test(ex.id) && !/-variant-[a-z0-9-]+$/.test(ex.id));
}

export function groupExamples(all: readonly ExampleMetadata[]): PickerGroup[] {
  const items = filterTopLevelExamples(all);
  const grouped: PickerGroup[] = DISPLAY_CATEGORIES.map(({ id, label }) => ({
    id,
    label,
    items: items
      .filter((ex) => ex.category === id)
      .slice()
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
  }));

  const remaining = items.filter((ex) => !ex.category);
  if (remaining.length > 0) {
    grouped.push({ id: 'more', label: 'More', items: remaining });
  }

  return grouped.filter((g) => g.items.length > 0);
}
