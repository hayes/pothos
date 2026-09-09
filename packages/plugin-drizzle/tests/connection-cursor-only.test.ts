import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// A connection whose document selects neither `nodes` nor `edges.node` needs its rows only for
// their cursors, so the relation query selects the cursor columns and nothing else.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { user: { id: number } };
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

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    postsConnection: t.relatedConnection('posts'),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
    title: t.exposeString('title'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
  }),
});

const schema = builder.toSchema();

describe('connection selecting only pageInfo', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('loads only the cursor columns of the related rows', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsConnection(first: 2) {
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: { postsConnection: { pageInfo: { hasNextPage: true, endCursor: expect.any(String) } } },
    });
    expect(drizzleLogs).toHaveLength(1);
    expect(drizzleLogs[0]).toContain('"d1"."id" as "postId"');
    expect(drizzleLogs[0]).not.toContain('"title"');
  });
});
