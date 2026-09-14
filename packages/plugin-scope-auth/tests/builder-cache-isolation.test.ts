import SchemaBuilder, { initContextCache } from '@pothos/core';
import { graphql } from 'graphql';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin, { RequestCache } from '../src';
import { db } from './example/db';

function createSchema(allowed: boolean | (() => boolean)) {
  const builder = new SchemaBuilder<{ AuthScopes: { allowed: boolean } }>({
    plugins: [ScopeAuthPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: {
      authScopes: () => ({ allowed: typeof allowed === 'function' ? allowed() : allowed }),
    },
  });
  builder.queryType({
    fields: (t) => ({
      secret: t.string({ authScopes: { allowed: true }, resolve: () => 'secret' }),
    }),
  });
  return builder.toSchema();
}

it.each([
  false,
  true,
])('isolates builders sharing a request context (copied: %s)', async (copied) => {
  const allowed = createSchema(true);
  const denied = createSchema(false);
  const context = { ...initContextCache() };
  expect(
    (await graphql({ schema: allowed, source: '{ secret }', contextValue: context })).data,
  ).toEqual({ secret: 'secret' });
  const result = await graphql({
    schema: denied,
    source: '{ secret }',
    contextValue: copied ? { ...context } : context,
  });
  expect(result.data).toEqual({ secret: null });
  expect(result.errors?.[0].message).toBe('Not authorized to resolve Query.secret');
});

it('clears the authorization cache for every builder sharing the context', async () => {
  let allowed = true;
  const schemas = [createSchema(() => allowed), createSchema(() => allowed)];
  const contextValue = { ...initContextCache() };
  for (const schema of schemas) {
    expect((await graphql({ schema, source: '{ secret }', contextValue })).data).toEqual({
      secret: 'secret',
    });
  }
  allowed = false;
  RequestCache.clearForContext({ ...contextValue });
  for (const schema of schemas) {
    expect((await graphql({ schema, source: '{ secret }', contextValue })).data).toEqual({
      secret: null,
    });
  }
});
