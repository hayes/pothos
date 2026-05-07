export interface PluginEntry {
  name: string;
  desc: string;
  icon: string;
  href?: string;
}

export const PLUGINS: PluginEntry[] = [
  { name: 'Prisma', desc: 'Efficient Prisma integration that solves N+1 and more.', icon: '◆', href: '/docs/plugins/prisma' },
  { name: 'Drizzle', desc: "Drizzle's relational query builder, type-safe.", icon: '◇', href: '/docs/plugins/drizzle' },
  { name: 'Relay', desc: 'Cursor-based connections & nodes, done right.', icon: '↻', href: '/docs/plugins/relay' },
  { name: 'Auth', desc: 'Field- and type-level authorization checks.', icon: '✦', href: '/docs/plugins/scope-auth' },
  { name: 'Dataloader', desc: 'Define data-loaders inline — no n+1.', icon: '≡', href: '/docs/plugins/dataloader' },
  { name: 'Errors', desc: 'Strongly typed errors as union types.', icon: '✕', href: '/docs/plugins/errors' },
  { name: 'Validation', desc: 'Zod, Valibot, ArkType — built in.', icon: '✓', href: '/docs/plugins/validation' },
  { name: 'Tracing', desc: 'OpenTelemetry, NewRelic, Sentry, custom.', icon: '◯', href: '/docs/plugins/tracing' },
  { name: 'Directives', desc: 'Schema directives, type-safe.', icon: '@', href: '/docs/plugins/directives' },
  { name: 'Smart Subs', desc: 'Subscribe to any part of your graph.', icon: '~', href: '/docs/plugins/smart-subscriptions' },
  { name: 'Complexity', desc: 'Define and limit query complexity.', icon: '⚡', href: '/docs/plugins/complexity' },
  { name: 'Mocks', desc: 'Mock resolvers for easier testing.', icon: '◐', href: '/docs/plugins/mocks' },
];
