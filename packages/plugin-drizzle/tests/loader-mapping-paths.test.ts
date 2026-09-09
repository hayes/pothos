import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// Loader mappings are keyed by the full path from the planned field, so a relation selected
// under both `nodes` and `edges.node` of a connection is answered from the loaded rows in both
// places instead of the second path falling back to a query of its own.
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
  relay: {
    nodesOnConnection: true,
  },
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName', { nullable: true }),
    postsConnection: t.relatedConnection('posts'),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
    author: t.relation('author'),
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

describe('loader mappings keyed by path', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('answers a relation selected under both nodes and edges.node from one query', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsConnection(first: 2) {
              nodes {
                id
                author {
                  firstName
                }
              }
              edges {
                node {
                  id
                  writer: author {
                    id
                  }
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();

    const connection = (result.data as { user: { postsConnection: { nodes: unknown[] } } }).user
      .postsConnection;

    expect(connection.nodes).toHaveLength(2);
    expect(connection).toEqual({
      nodes: expect.arrayContaining([
        { id: expect.any(String), author: { firstName: expect.any(String) } },
      ]),
      edges: expect.arrayContaining([
        { node: { id: expect.any(String), writer: { id: expect.any(String) } } },
      ]),
    });
    expect(drizzleLogs).toHaveLength(1);
  });
});
