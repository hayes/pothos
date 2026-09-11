/**
 * Full catalog of first-party Pothos plugins, with categorization for
 * the /plugins overview page. Each entry maps to a docs page at
 * `/docs/plugins/<slug>` and an npm package `@pothos/plugin-<slug>`.
 */

export type PluginCategory = 'data' | 'schema' | 'auth' | 'live' | 'devx';

export interface PluginEntry {
  slug: string;
  name: string;
  description: string;
  /** Visual mark — single character typeset against accent-soft. */
  icon: string;
  category: PluginCategory;
  /** Sort key within its category — lower goes first. */
  order?: number;
}

export const PLUGIN_CATEGORIES: Record<
  PluginCategory,
  { label: string; eyebrow: string; description: string }
> = {
  data: {
    label: 'Connect to your data',
    eyebrow: 'Data',
    description: 'Plug Pothos into the database / data layer you already use.',
  },
  schema: {
    label: 'Shape your schema',
    eyebrow: 'Schema',
    description:
      'Plugins for common schema patterns: connections, federation, sub-graphs, and directives.',
  },
  auth: {
    label: 'Auth, errors, and validation',
    eyebrow: 'Safety',
    description: 'Authorization checks, typed errors, validation, and complexity limits.',
  },
  live: {
    label: 'Live data',
    eyebrow: 'Live',
    description: 'Subscriptions, and execution plans in place of resolvers.',
  },
  devx: {
    label: 'Developer experience',
    eyebrow: 'DevEx',
    description: 'Mocking, tracing, and tools that make Pothos schemas easier to work on.',
  },
};

export const PLUGINS: PluginEntry[] = [
  // ── Data ──────────────────────────────────────────────────────────
  {
    slug: 'prisma',
    name: 'Prisma',
    description: 'Build Prisma queries from GraphQL selections',
    icon: '◆',
    category: 'data',
    order: 1,
  },
  {
    slug: 'drizzle',
    name: 'Drizzle',
    description: 'Build queries from GraphQL selections using Drizzle’s relational query builder',
    icon: '◇',
    category: 'data',
    order: 2,
  },
  {
    slug: 'dataloader',
    name: 'Dataloader',
    description: 'Batch and cache data loading for types and fields',
    icon: '≡',
    category: 'data',
    order: 3,
  },
  {
    slug: 'add-graphql',
    name: 'Add GraphQL',
    description: 'Add existing GraphQL types to your schema',
    icon: '＋',
    category: 'data',
    order: 4,
  },

  // ── Schema ────────────────────────────────────────────────────────
  {
    slug: 'relay',
    name: 'Relay',
    description: 'Define Relay nodes, global IDs, and paginated connections',
    icon: '↻',
    category: 'schema',
    order: 1,
  },
  {
    slug: 'federation',
    name: 'Federation',
    description: 'Build subgraphs for Apollo Federation',
    icon: '◈',
    category: 'schema',
    order: 2,
  },
  {
    slug: 'sub-graph',
    name: 'Sub-graph',
    description: 'Build separate schemas from subsets of your types and fields',
    icon: '⌗',
    category: 'schema',
    order: 3,
  },
  {
    slug: 'directives',
    name: 'Directives',
    description: 'Attach directive metadata to your schema',
    icon: '@',
    category: 'schema',
    order: 4,
  },
  {
    slug: 'simple-objects',
    name: 'Simple Objects',
    description: 'Infer backing types from fields that expose data properties',
    icon: '□',
    category: 'schema',
    order: 5,
  },
  {
    slug: 'with-input',
    name: 'With-Input',
    description: 'Define fields with inline input objects',
    icon: '⊟',
    category: 'schema',
    order: 6,
  },

  // ── Auth / safety ─────────────────────────────────────────────────
  {
    slug: 'scope-auth',
    name: 'Scope Auth',
    description: 'Authorize access to fields and types using request data',
    icon: '✦',
    category: 'auth',
    order: 1,
  },
  {
    slug: 'errors',
    name: 'Errors',
    description: 'Expose expected resolver errors as typed GraphQL results',
    icon: '✕',
    category: 'auth',
    order: 2,
  },
  {
    slug: 'validation',
    name: 'Validation',
    description: 'Validate inputs with Standard Schema libraries such as Zod, Valibot, and ArkType',
    icon: '✓',
    category: 'auth',
    order: 3,
  },
  {
    slug: 'complexity',
    name: 'Complexity',
    description: 'Define field costs and limit query complexity',
    icon: '↯',
    category: 'auth',
    order: 4,
  },

  // ── Live ──────────────────────────────────────────────────────────
  {
    slug: 'smart-subscriptions',
    name: 'Smart Subscriptions',
    description: 'Update query results when subscribed data changes',
    icon: '~',
    category: 'live',
    order: 1,
  },
  {
    slug: 'grafast',
    name: 'Grafast',
    description: 'Define Grafast plans for your schema',
    icon: '☉',
    category: 'live',
    order: 2,
  },

  // ── DevX ──────────────────────────────────────────────────────────
  {
    slug: 'mocks',
    name: 'Mocks',
    description: 'Add mock resolvers for easier testing',
    icon: '◐',
    category: 'devx',
    order: 1,
  },
  {
    slug: 'tracing',
    name: 'Tracing',
    description:
      'Trace resolver execution with OpenTelemetry, New Relic, Sentry, or custom tracers',
    icon: '◯',
    category: 'devx',
    order: 2,
  },
];

/** Canonical docs URL for a plugin's page. */
export function pluginDocsHref(slug: string): string {
  return `/docs/plugins/${slug}`;
}

/** Canonical npm package name for a plugin. */
export function pluginPackage(slug: string): string {
  return `@pothos/plugin-${slug}`;
}

const CATEGORY_ORDER: PluginCategory[] = ['data', 'schema', 'auth', 'live', 'devx'];

export function pluginsByCategory(): Array<{ category: PluginCategory; items: PluginEntry[] }> {
  return CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: PLUGINS.filter((p) => p.category === cat).sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999),
    ),
  }));
}
