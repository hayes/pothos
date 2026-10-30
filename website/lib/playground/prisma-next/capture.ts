import * as runtime from '@prisma/orm-sqlite/runtime';
import { getExtensionPanels, pushExtensionPanel } from '../extension-panels-slot';
import type { ExtensionPanel, ExtensionSubPanel } from '../playground-panels';

let current: (ExtensionPanel & { tabs: ExtensionSubPanel[] }) | undefined;

function serialize(_key: string, value: unknown) {
  return typeof value === 'bigint' ? String(value) : value;
}

/** Record each executed statement in the response's SQL tab. */
export function captureStatement({ sql, params }: { sql: string; params: readonly unknown[] }) {
  if (!current || !getExtensionPanels().includes(current)) {
    current = { name: 'SQL', tabs: [] };
    pushExtensionPanel(current);
  }
  const verb = sql.trim().split(/\s+/, 1)[0]?.toUpperCase() ?? 'SQL';
  current.tabs.push({
    name: `${current.tabs.length + 1}. ${verb}`,
    language: 'sql',
    content: `${sql.trim()}${params.length ? `\n\n-- params: ${JSON.stringify(params, serialize)}` : ''}`,
  });
}

const captureMiddleware = {
  name: 'pothos-playground-capture',
  familyId: 'sql' as const,
  beforeEncode(plan: { sql: string; params: readonly unknown[] }) {
    captureStatement(plan);
    return Promise.resolve();
  },
};

type SqliteOptions = { middleware?: readonly unknown[] };

// Keep the upstream factory. Only the playground module registry substitutes this, so authored
// examples remain ordinary, copyable client code.
const sqlite = new Proxy(runtime.default, {
  apply(target, receiver, [options]: [SqliteOptions]) {
    return Reflect.apply(target, receiver, [
      { ...options, middleware: [...(options.middleware ?? []), captureMiddleware] },
    ]);
  },
});

export const sqliteRuntime = { ...runtime, default: sqlite };
