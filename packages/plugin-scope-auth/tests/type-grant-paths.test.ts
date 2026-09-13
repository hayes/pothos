import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import { vi } from 'vitest';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin from '../src';
import { db } from './example/db';

it.each([
  false,
  true,
])('installs type grants at every response path (async: %s)', async (asyncGrants) => {
  const grants = vi.fn(() => ['allowed']);
  const builder = new SchemaBuilder({
    plugins: [ScopeAuthPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: { authScopes: () => ({}) },
  });
  const value = { secret: 'secret' };
  const Item = builder.objectRef<typeof value>('Item').implement({
    grantScopes: () => (asyncGrants ? Promise.resolve(grants()) : grants()),
    fields: (t) => ({
      secret: t.exposeString('secret', { authScopes: { $granted: 'allowed' } }),
    }),
  });
  builder.queryType({
    fields: (t) => ({ items: t.field({ type: [Item], resolve: () => [value, value] }) }),
  });
  const schema = builder.toSchema();
  for (const source of [
    '{ a: items { secret } b: items { secret } }',
    '{ b: items { secret } a: items { secret } }',
  ]) {
    grants.mockClear();
    const result = await graphql({ schema, source, contextValue: {} });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ a: [value, value], b: [value, value] });
    expect(grants).toHaveBeenCalledTimes(1);
  }
});
