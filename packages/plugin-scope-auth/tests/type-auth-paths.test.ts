import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import { vi } from 'vitest';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin from '../src';
import { db } from './example/db';

it.each([false, true])('evaluates type grants at each path (async: %s)', async (asyncScopes) => {
  const calls = vi.fn(() => ({ $any: { $granted: 'allowed' } }));
  const builder = new SchemaBuilder({
    plugins: [ScopeAuthPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: { authScopes: () => ({}) },
  });
  const value = { secret: 'secret' };
  const Item = builder.objectRef<typeof value>('Item').implement({
    authScopes: () => (asyncScopes ? Promise.resolve(calls()) : calls()),
    fields: (t) => ({ secret: t.exposeString('secret') }),
  });
  builder.queryType({
    fields: (t) => ({
      allowed: t.field({ type: Item, grantScopes: ['allowed'], resolve: () => value }),
      denied: t.field({ type: Item, resolve: () => value }),
    }),
  });
  const schema = builder.toSchema();
  for (const source of [
    '{ allowed { secret } denied { secret } }',
    '{ denied { secret } allowed { secret } }',
  ]) {
    calls.mockClear();
    const result = await graphql({ schema, source, contextValue: {} });
    expect(result.data).toEqual({ allowed: { secret: 'secret' }, denied: { secret: null } });
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].path).toEqual(['denied', 'secret']);
    expect(calls).toHaveBeenCalledTimes(1);
  }
});
