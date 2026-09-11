import SchemaBuilder from '@pothos/core';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import DrizzlePlugin, { drizzleConnectionHelpers } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  AsyncSelections: true;
}>({
  plugins: [DrizzlePlugin],
  scopeAuth: { authScopes: () => ({}) },
  drizzle: { client: db, relations, getTableConfig },
});

// Both the helper's select and the caller's nested selection can start asynchronous work
// before the query callback runs. Its synchronous failure must leave neither promise orphaned.
it.each([
  'helper',
  'nested',
] as const)('handles a pending %s selection when the query callback throws', async (source) => {
  const queryError = new Error('query failed');
  let rejectSelection!: (reason: Error) => void;
  const pending = new Promise<never>((_resolve, reject) => {
    rejectSelection = reject;
  });
  const helpers = drizzleConnectionHelpers(builder, 'comments', {
    select: source === 'helper' ? () => pending : undefined,
    query: () => {
      throw queryError;
    },
  });
  const unhandled: unknown[] = [];
  const onUnhandled = (error: unknown) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);

  try {
    expect(() => helpers.getQuery({}, {}, () => pending, { awaitSelections: true })).toThrow(
      queryError,
    );
    rejectSelection(new Error('selection failed'));
    // Node reports an unhandled rejection after the current microtask queue drains.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
