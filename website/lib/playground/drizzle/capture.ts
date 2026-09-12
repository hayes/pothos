import { Column, getTableName, SQL, Table } from 'drizzle-orm';
import { getExtensionPanels, pushExtensionPanel } from '../extension-panels-slot';
import type { ExtensionPanel, ExtensionSubPanel } from '../playground-panels';

let current: (ExtensionPanel & { tabs: ExtensionSubPanel[] }) | undefined;

/** Diagnostic snapshots, not executable JSON: callbacks are never called and getters never read. */
export function snapshotQuery(value: unknown): unknown {
  const ancestors = new Map<object, string>();
  let remaining = 1000;

  function visit(value: unknown, path: string, depth: number): unknown {
    if (--remaining < 0 || depth > 12) {
      return { $type: 'Truncated' };
    }
    if (value === undefined) {
      return { $type: 'undefined' };
    }
    if (typeof value === 'bigint') {
      return { $type: 'bigint', value: String(value) };
    }
    if (typeof value === 'function') {
      return { $type: 'Function', source: Function.prototype.toString.call(value) };
    }
    if (typeof value === 'symbol') {
      return { $type: 'Symbol', value: String(value) };
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return { $type: 'number', value: String(value) };
    }
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (ancestors.has(value)) {
      return { $type: 'Circular', path: ancestors.get(value) };
    }
    if (value instanceof Date) {
      return {
        $type: 'Date',
        value: Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString(),
      };
    }
    if (value instanceof Column) {
      return {
        $type: 'Column',
        table: getTableName((value as Column & { table: Table }).table),
        name: value.name,
      };
    }
    if (value instanceof Table) {
      return { $type: 'Table', name: getTableName(value) };
    }

    ancestors.set(value, path);
    try {
      if (Array.isArray(value)) {
        const items: unknown[] = [];
        for (let i = 0; i < value.length; i++) {
          if (remaining <= 0) {
            items.push({ $type: 'Truncated', omittedItems: value.length - i });
            break;
          }
          const descriptor = Object.getOwnPropertyDescriptor(value, i);
          items.push(
            descriptor
              ? 'value' in descriptor
                ? visit(descriptor.value, `${path}[${i}]`, depth + 1)
                : { $type: 'Accessor', note: 'Not evaluated' }
              : { $type: 'Empty slot' },
          );
        }
        return items;
      }
      if (value instanceof SQL) {
        return { $type: 'SQL', chunks: visit(value.queryChunks, `${path}.chunks`, depth + 1) };
      }
      const properties: Record<string, unknown> = {};
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!descriptor.enumerable) {
          continue;
        }
        if (remaining <= 0) {
          return { $type: 'Truncated object', properties, note: 'Remaining properties omitted' };
        }
        const name = typeof key === 'symbol' ? `[${String(key)}]` : key;
        Object.defineProperty(properties, name, {
          value:
            'value' in descriptor
              ? visit(descriptor.value, `${path}.${name}`, depth + 1)
              : { $type: 'Accessor', note: 'Not evaluated' },
          enumerable: true,
        });
      }
      const prototype = Object.getPrototypeOf(value);
      return prototype === Object.prototype || prototype === null
        ? properties
        : {
            $type:
              Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value?.name ?? 'Object',
            properties,
          };
    } finally {
      ancestors.delete(value);
    }
  }

  try {
    return visit(value, '$', 0);
  } catch {
    // An unusual proxy/object must not stop the database call merely because inspection failed.
    return { $type: 'Uninspectable', note: 'The argument could not be inspected safely' };
  }
}

function capture(method: string, args: unknown[]) {
  if (!current || !getExtensionPanels().includes(current)) {
    current = { name: 'Queries', tabs: [] };
    pushExtensionPanel(current);
  }
  current.tabs.push({
    name: `${current.tabs.length + 1}. ${method}`,
    language: 'json',
    content: JSON.stringify({ method, arguments: snapshotQuery(args) }, null, 2),
  });
}

/** Capture API invocations, including fallback loads, before Drizzle processes the options. */
export function captureDrizzleQueries<T extends object>(db: T): T {
  const proxies = new WeakMap<object, object>();
  function wrap<T extends object>(target: T, kind: 'db' | 'query' | 'table', path: string): T {
    if (proxies.has(target)) {
      return proxies.get(target) as T;
    }
    const proxy = new Proxy(target, {
      get(target, key, receiver) {
        const value: unknown = Reflect.get(target, key, receiver);
        if (kind === 'db' && key === 'query' && value && typeof value === 'object') {
          return wrap(value, 'query', 'db.query');
        }
        if (kind === 'query' && typeof key === 'string' && value && typeof value === 'object') {
          return wrap(value, 'table', `${path}.${key}`);
        }
        if (
          typeof value === 'function' &&
          ((kind === 'table' && (key === 'findFirst' || key === 'findMany')) ||
            (kind === 'db' && key === '$count'))
        ) {
          return (...args: unknown[]) => {
            capture(`${path}.${String(key)}`, args);
            return Reflect.apply(value, target, args);
          };
        }
        return value;
      },
    });
    proxies.set(target, proxy);
    return proxy;
  }
  return wrap(db, 'db', 'db');
}
