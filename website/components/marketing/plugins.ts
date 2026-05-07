export interface PluginEntry {
  name: string;
  desc: string;
  icon: string;
  href: string;
}

/**
 * Curated list of headline plugins for the home page grid. Names match
 * the docs entries (`/docs/plugins/<slug>`) so the cards link to the
 * right page and read identically to the rest of the site.
 */
export const PLUGINS: PluginEntry[] = [
  {
    name: 'Prisma',
    desc: 'Efficient Prisma integration that solves N+1 and more.',
    icon: '◆',
    href: '/docs/plugins/prisma',
  },
  {
    name: 'Drizzle',
    desc: "Drizzle's relational query builder, type-safe.",
    icon: '◇',
    href: '/docs/plugins/drizzle',
  },
  {
    name: 'Relay',
    desc: 'Cursor-based connections & nodes, done right.',
    icon: '↻',
    href: '/docs/plugins/relay',
  },
  {
    name: 'Scope Auth',
    desc: 'Field- and type-level authorization checks.',
    icon: '✦',
    href: '/docs/plugins/scope-auth',
  },
  {
    name: 'Dataloader',
    desc: 'Inline data-loaders — solve N+1 without ceremony.',
    icon: '≡',
    href: '/docs/plugins/dataloader',
  },
  {
    name: 'Errors',
    desc: 'Strongly typed errors as union types.',
    icon: '✕',
    href: '/docs/plugins/errors',
  },
  {
    name: 'Validation',
    desc: 'Zod / Valibot / ArkType — built in.',
    icon: '✓',
    href: '/docs/plugins/validation',
  },
  {
    name: 'Tracing',
    desc: 'OpenTelemetry, New Relic, Sentry, custom adapters.',
    icon: '◯',
    href: '/docs/plugins/tracing',
  },
  {
    name: 'Directives',
    desc: 'Schema directives, type-safe.',
    icon: '@',
    href: '/docs/plugins/directives',
  },
  {
    name: 'Smart Subscriptions',
    desc: 'Subscribe to any part of your graph.',
    icon: '~',
    href: '/docs/plugins/smart-subscriptions',
  },
  {
    name: 'Complexity',
    desc: 'Define and limit query complexity.',
    icon: '⚡',
    href: '/docs/plugins/complexity',
  },
  {
    name: 'Federation',
    desc: 'Apollo Federation 2 schemas, the Pothos way.',
    icon: '◈',
    href: '/docs/plugins/federation',
  },
];
