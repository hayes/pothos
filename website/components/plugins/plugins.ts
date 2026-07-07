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
      'Builders for the schema patterns the spec calls for — connections, federation, sub-graphs, and friends.',
  },
  auth: {
    label: 'Auth, errors, and validation',
    eyebrow: 'Safety',
    description:
      'Authorization checks, typed errors, validation, and complexity limits — built in, type-safe.',
  },
  live: {
    label: 'Live data',
    eyebrow: 'Live',
    description:
      'Subscriptions and execution-plan plugins for real-time and large-graph workloads.',
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
    description:
      'Define types from your Prisma models, with relations resolved in a single query.',
    icon: '◆',
    category: 'data',
    order: 1,
  },
  {
    slug: 'drizzle',
    name: 'Drizzle',
    description: "Define types from your Drizzle schema, resolved through its relational query builder.",
    icon: '◇',
    category: 'data',
    order: 2,
  },
  {
    slug: 'dataloader',
    name: 'Dataloader',
    description: 'Batch and cache loads with dataloaders declared on types and fields.',
    icon: '≡',
    category: 'data',
    order: 3,
  },
  {
    slug: 'add-graphql',
    name: 'Add GraphQL',
    description: 'Fold existing GraphQL types or SDL into your Pothos schema.',
    icon: '＋',
    category: 'data',
    order: 4,
  },

  // ── Schema ────────────────────────────────────────────────────────
  {
    slug: 'relay',
    name: 'Relay',
    description:
      'Connections, Node interfaces, and global IDs following the Relay spec.',
    icon: '↻',
    category: 'schema',
    order: 1,
  },
  {
    slug: 'federation',
    name: 'Federation',
    description: 'Build Apollo Federation 2 subgraphs from a Pothos schema.',
    icon: '◈',
    category: 'schema',
    order: 2,
  },
  {
    slug: 'sub-graph',
    name: 'Sub-graph',
    description:
      'Generate multiple subsets of one schema to share code between internal and external APIs.',
    icon: '⌗',
    category: 'schema',
    order: 3,
  },
  {
    slug: 'directives',
    name: 'Directives',
    description: 'Type-safe GraphQL directives for fields, types, and arguments.',
    icon: '@',
    category: 'schema',
    order: 4,
  },
  {
    slug: 'simple-objects',
    name: 'Simple Objects',
    description: 'Define plain object types without resolvers or manual type declarations.',
    icon: '□',
    category: 'schema',
    order: 5,
  },
  {
    slug: 'with-input',
    name: 'With-Input',
    description: 'Inline `input` objects defined right next to the field that uses them.',
    icon: '⊟',
    category: 'schema',
    order: 6,
  },

  // ── Auth / safety ─────────────────────────────────────────────────
  {
    slug: 'scope-auth',
    name: 'Scope Auth',
    description: 'Field- and type-level authorization checks with scope composition.',
    icon: '✦',
    category: 'auth',
    order: 1,
  },
  {
    slug: 'errors',
    name: 'Errors',
    description: 'Strongly-typed errors as union return types, with auto-resolved success types.',
    icon: '✕',
    category: 'auth',
    order: 2,
  },
  {
    slug: 'validation',
    name: 'Validation',
    description: 'Argument validation via any StandardSchema v1 library — Zod, Valibot, ArkType.',
    icon: '✓',
    category: 'auth',
    order: 3,
  },
  {
    slug: 'complexity',
    name: 'Complexity',
    description: 'Per-field complexity scoring with query-level limits.',
    icon: '↯',
    category: 'auth',
    order: 4,
  },

  // ── Live ──────────────────────────────────────────────────────────
  {
    slug: 'smart-subscriptions',
    name: 'Smart Subscriptions',
    description: 'Subscriptions that re-run queries when the data they read changes.',
    icon: '~',
    category: 'live',
    order: 1,
  },
  {
    slug: 'grafast',
    name: 'Grafast',
    description: 'Execute with Grafast plans in place of resolver functions.',
    icon: '☉',
    category: 'live',
    order: 2,
  },

  // ── DevX ──────────────────────────────────────────────────────────
  {
    slug: 'mocks',
    name: 'Mocks',
    description: 'Drop-in mock resolvers for testing and local development.',
    icon: '◐',
    category: 'devx',
    order: 1,
  },
  {
    slug: 'tracing',
    name: 'Tracing',
    description: 'Resolver tracing with adapters for OpenTelemetry, New Relic, Sentry, custom.',
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
