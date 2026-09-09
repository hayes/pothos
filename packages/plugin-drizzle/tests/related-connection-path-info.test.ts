import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin, { type PathInfo } from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// A relatedConnection `query` callback runs once while the selection is planned and once while
// the connection resolves. Both calls see the same `pathInfo`, so a query that branches on it
// pages the rows it selected.
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

const seenPaths: (string[] | null)[] = [];

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    postsConnection: t.relatedConnection('posts', {
      query: ((_args: {}, _ctx: {}, pathInfo: PathInfo | undefined) => {
        seenPaths.push(pathInfo?.path ?? null);

        // A page of one row under the user query, a bigger page anywhere else.
        return {
          orderBy: { postId: 'asc' },
          limit: pathInfo?.path[0] === 'Query.user' ? 2 : 5,
        };
      }) as never,
    }),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    // Returns a row fetched without the planned selection, so the connection loads its own
    // rows through the model loader and resolves from that row.
    rawUser: t.drizzleField({
      type: User,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('relatedConnection pathInfo on the resolve path', () => {
  afterEach(() => {
    clearDrizzleLogs();
    seenPaths.length = 0;
  });

  it('hands the planned pathInfo to the query callback when resolving', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsConnection(first: 5) {
              edges {
                node {
                  id
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(seenPaths).toEqual([
      ['Query.user', 'User.postsConnection'],
      ['Query.user', 'User.postsConnection'],
    ]);
    // The planned limit of 2 fetches two rows; resolving with the same limit reports a next
    // page and keeps one edge, as the plan intended.
    expect(result.data).toEqual({
      user: {
        postsConnection: {
          edges: [{ node: { id: expect.any(String) } }],
          pageInfo: { hasNextPage: true },
        },
      },
    });
    expect(drizzleLogs).toHaveLength(1);
  });

  it('agrees with itself when the connection loads through the model loader', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          rawUser {
            postsConnection(first: 5) {
              edges {
                node {
                  id
                }
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    // `rawUser` plans the document before its resolver runs (whether or not the resolver asks for
    // the query), so the callback first sees the root path; the loader then plans the field
    // alone, so the path starts at the field, and the resolve path agrees with that plan.
    expect(seenPaths).toEqual([
      ['Query.rawUser', 'User.postsConnection'],
      ['User.postsConnection'],
      ['User.postsConnection'],
    ]);
    expect(result.data).toEqual({
      rawUser: {
        postsConnection: {
          edges: [
            { node: { id: expect.any(String) } },
            { node: { id: expect.any(String) } },
            { node: { id: expect.any(String) } },
            { node: { id: expect.any(String) } },
          ],
          pageInfo: { hasNextPage: true },
        },
      },
    });
    expect(drizzleLogs).toHaveLength(2);
  });
});
