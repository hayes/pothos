import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { rebuildResolverPaths } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { execute, parse } from 'graphql';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// graphql-jit hands every resolver a path it builds afresh, sharing no link with any other
// resolver's and without a `typename`, and no `getAbortSignal`. Run that way, a document loads with the same queries.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { rebuildPaths?: boolean };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts', { query: { limit: 3, orderBy: { postId: 'asc' } } }),
    postsConnection: t.relatedConnection('posts', {
      query: () => ({ orderBy: { postId: 'asc' } }),
    }),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
    author: t.relation('author'),
    comments: t.relation('comments', { query: { limit: 2, orderBy: { id: 'asc' } } }),
  }),
});

builder.drizzleObject('comments', {
  name: 'Comment',
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author'),
  }),
});

builder.queryType({
  fields: (t) => ({
    users: t.drizzleField({
      type: ['users'],
      resolve: (query) => db.query.users.findMany(query({ limit: 10, orderBy: { id: 'asc' } })),
    }),
    // Loaded outside the plan, so every row falls back to the model loader.
    rawUsers: t.drizzleField({
      type: ['users'],
      resolve: () => db.query.users.findMany({ limit: 3, orderBy: { id: 'asc' } }),
    }),
  }),
});

const schema = builder.toSchema();

rebuildResolverPaths(schema, (context: { rebuildPaths?: boolean }) => !!context.rebuildPaths);

async function run(source: string, rebuildPaths: boolean) {
  clearDrizzleLogs();

  const result = await execute({ schema, document: parse(source), contextValue: { rebuildPaths } });
  const logs = [...drizzleLogs];

  clearDrizzleLogs();

  return { result, logs };
}

describe('an executor that builds a new path for each resolver', () => {
  it.each([
    '{ users { id posts { id author { id posts { id comments { id author { id } } } } } } }',
    '{ users { postsConnection(first: 2) { edges { node { id author { id posts { id } } comments { id } } } } } }',
  ])('loads a planned document in one query: %s', async (source) => {
    const expected = await run(source, false);
    const actual = await run(source, true);

    expect(expected.result.errors).toBeUndefined();
    expect(expected.logs).toHaveLength(1);
    expect(actual.logs).toEqual(expected.logs);
    expect(actual.result).toEqual(expected.result);
  });

  it('loads what is beneath a reloaded row with its reload', async () => {
    const source = '{ rawUsers { id posts { id author { id posts { id comments { id } } } } } }';
    const expected = await run(source, false);
    const actual = await run(source, true);

    expect(expected.result.errors).toBeUndefined();
    // The list, and one reload of its rows that loads everything beneath them.
    expect(expected.logs).toHaveLength(2);
    expect(actual.logs).toEqual(expected.logs);
    expect(actual.result).toEqual(expected.result);
  });
});
