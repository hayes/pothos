import { PLUGINS as ALL_PLUGINS, type PluginEntry } from '../plugins/plugins';

/**
 * Curated subset of canonical plugin slugs (in display order) shown in
 * the home page's plugin garden grid. The full catalog lives in
 * `components/plugins/plugins.ts` — that's the single source of truth
 * for plugin metadata. This file only picks which entries to surface.
 */
export const HOMEPAGE_SLUGS: string[] = [
  'prisma',
  'drizzle',
  'relay',
  'scope-auth',
  'dataloader',
  'errors',
  'validation',
  'tracing',
  'directives',
  'smart-subscriptions',
  'complexity',
  'federation',
];

const bySlug = new Map(ALL_PLUGINS.map((p) => [p.slug, p]));

export const HOMEPAGE_PLUGINS: PluginEntry[] = HOMEPAGE_SLUGS.map((slug) => {
  const entry = bySlug.get(slug);
  if (!entry) {
    throw new Error(`HOMEPAGE_SLUGS references unknown plugin slug: ${slug}`);
  }
  return entry;
});

export type { PluginEntry } from '../plugins/plugins';
