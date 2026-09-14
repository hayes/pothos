import SchemaBuilder from '@pothos/core';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin from '../src';
import { db } from './example/db';

it.each([
  { first: true, second: true },
  { $any: { first: true }, $all: { second: true } },
])('handles pending loader rejections when another loader throws: %j', async (scopes) => {
  const syncError = new Error('synchronous loader failure');
  const builder = new SchemaBuilder<{
    AuthScopes: { first: boolean; second: boolean };
  }>({
    plugins: [ScopeAuthPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: {
      authScopes: () => ({
        first: () => Promise.reject(new Error('asynchronous loader failure')),
        second: () => {
          throw syncError;
        },
      }),
    },
  });
  const unhandled: unknown[] = [];
  const onUnhandled = (error: unknown) => {
    unhandled.push(error);
  };
  process.on('unhandledRejection', onUnhandled);
  try {
    expect(() => builder.runAuthScopes({}, scopes)).toThrow(syncError);
    await new Promise((resolve) => setImmediate(resolve));
    expect(unhandled).toEqual([]);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});
