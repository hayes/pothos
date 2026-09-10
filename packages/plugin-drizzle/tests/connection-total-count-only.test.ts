import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// A document selecting only `totalCount` needs no rows, so the connection issues no row query.
// The connection's own nullability is not part of that: the check reads the named type, so a
// `nullable: false` connection (whose `info.returnType` is a non-null wrapper) behaves the same.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: {};
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
  }),
});

builder.queryType({
  fields: (t) => ({
    nullablePosts: t.drizzleConnection({
      type: 'posts',
      totalCount: () => 118,
      resolve: (query) => db.query.posts.findMany(query()),
    }),
    nonNullPosts: t.drizzleConnection({
      type: 'posts',
      nullable: false,
      totalCount: () => 118,
      resolve: (query) => db.query.posts.findMany(query()),
    }),
  }),
});

const schema = builder.toSchema({});

describe('totalCount-only connections', () => {
  it.each([
    ['nullablePosts', 'a nullable connection'],
    ['nonNullPosts', 'a non-null connection'],
  ])('%s queries no rows for %s', async (field) => {
    clearDrizzleLogs();

    const result = await execute({
      schema,
      document: gql`
        query Posts($first: Int) {
          ${field}(first: $first) {
            totalCount
          }
        }
      `,
      variableValues: { first: 2 },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ [field]: { totalCount: 118 } });
    expect(drizzleLogs).toEqual([]);
  });
});
