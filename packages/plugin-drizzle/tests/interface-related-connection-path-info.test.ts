import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, relations } from './example/db';

// A `relatedConnection` inherited from a drizzle interface pages with the `pathInfo` it was
// planned with, like one declared on the object itself.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
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

const seenPaths: string[][] = [];

const IUser = builder.drizzleInterface('users', {
  name: 'IUser',
  resolveType: () => 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    // Newest first when planned from a root field, oldest first when planned alone (a reload):
    // rows and cursors from different calls cannot agree by accident.
    posts: t.relatedConnection('posts', {
      query: (_args, _ctx, pathInfo) => {
        seenPaths.push(pathInfo.path);

        return { orderBy: { postId: pathInfo.path[0].startsWith('Query.') ? 'desc' : 'asc' } };
      },
    }),
  }),
});

builder.drizzleObject('users', {
  variant: 'User',
  interfaces: [IUser],
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
      type: IUser,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    // A row fetched without the planned selection, so the connection reloads it.
    rawUser: t.field({
      type: IUser,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }),
    }),
    // The first row loaded by the planned query, the second fetched without it.
    mixedUsers: t.drizzleField({
      type: [IUser],
      resolve: async (query) => {
        const planned = await db.query.users.findFirst(query({ where: { id: 1 } }));
        const raw = await db.query.users.findFirst({ where: { id: 2 } });

        return [planned!, raw!];
      },
    }),
  }),
});

const schema = builder.toSchema();

interface Page {
  edges: { cursor: string; node: { id: string } }[];
}

const postIds = async (authorId: number, order: 'asc' | 'desc') =>
  (
    await db.query.posts.findMany({
      columns: { postId: true },
      where: { authorId },
      orderBy: { postId: order },
    })
  ).map((post) => String(post.postId));

describe('relatedConnection inherited from a drizzle interface', () => {
  afterEach(() => {
    clearDrizzleLogs();
    seenPaths.length = 0;
  });

  it('resolves with the pathInfo it was planned with', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            posts(first: 2) {
              edges {
                cursor
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(seenPaths).toEqual([
      ['Query.user', 'IUser.posts'],
      ['Query.user', 'IUser.posts'],
    ]);

    const expected = await postIds(1, 'desc');
    const page = (result.data as { user: { posts: Page } }).user.posts;

    expect(page.edges.map((edge) => edge.node.id)).toEqual(expected.slice(0, 2));

    const next = await execute({
      schema,
      document: gql`
        query ($after: String) {
          user {
            posts(first: 2, after: $after) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      variableValues: { after: page.edges[1].cursor },
      contextValue: {},
    });

    expect(next.errors).toBeUndefined();
    expect(
      (next.data as { user: { posts: Page } }).user.posts.edges.map((edge) => edge.node.id),
    ).toEqual(expected.slice(2, 4));
  });

  it('resolves a reloaded row with the pathInfo of the reload', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          rawUser {
            posts(first: 2) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    // The reload plans the field alone, for the row's concrete type, so its path starts at the
    // field.
    expect(seenPaths).toEqual([['User.posts'], ['User.posts']]);
    expect(
      (result.data as { rawUser: { posts: Page } }).rawUser.posts.edges.map((edge) => edge.node.id),
    ).toEqual((await postIds(1, 'asc')).slice(0, 2));
  });

  it('pages each row of a list with the position its own rows were loaded at', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          mixedUsers {
            posts(first: 2) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();

    const [planned, reloaded] = (result.data as { mixedUsers: { posts: Page }[] }).mixedUsers;

    expect(planned.posts.edges.map((edge) => edge.node.id)).toEqual(
      (await postIds(1, 'desc')).slice(0, 2),
    );
    expect(reloaded.posts.edges.map((edge) => edge.node.id)).toEqual(
      (await postIds(2, 'asc')).slice(0, 2),
    );
  });
});
