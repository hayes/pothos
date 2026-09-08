import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin, { type PathInfo } from '../src';
import { getSchemaConfig } from '../src/utils/config';
import { queryFromInfo } from '../src/utils/map-query';
import { clearDrizzleLogs, type DrizzleRelations, db, relations } from './example/db';

// `pathInfo.path` handed to relation `query` callbacks starts with the root field whether the
// query was planned directly for the field or through `path`/`paths`.
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

const capturedPaths: PathInfo[] = [];

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts', {
      // The callback also runs without pathInfo while the nested query is planned.
      query: (_args, _ctx, pathInfo) => {
        if (pathInfo) {
          capturedPaths.push(pathInfo);
        }

        return {};
      },
    }),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
  }),
});

interface UsersPageShape {
  nodes: { id: number; username: string; firstName: string | null; lastName: string | null }[];
}

const UsersPage = builder.objectRef<UsersPageShape>('UsersPage').implement({
  fields: (t) => ({
    nodes: t.field({ type: [User], resolve: (page) => page.nodes }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
    usersPage: t.field({
      type: UsersPage,
      resolve: async (_root, _args, context, info) => ({
        nodes: await db.query.users.findMany({
          ...queryFromInfo({
            config: getSchemaConfig(builder),
            context,
            info,
            typeName: 'User',
            paths: [['nodes'], ['edges', 'node']],
          }),
          limit: 1,
        }),
      }),
    }),
  }),
});

const schema = builder.toSchema();

describe('pathInfo for queries planned through paths', () => {
  afterEach(() => {
    clearDrizzleLogs();
    capturedPaths.length = 0;
  });

  it('starts with the root field for the direct entry', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            posts {
              id
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(capturedPaths.map((pathInfo) => pathInfo.path)).toEqual([['Query.user', 'User.posts']]);
  });

  it('starts with the root field for the paths entry', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          usersPage {
            nodes {
              posts {
                id
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(capturedPaths.map((pathInfo) => pathInfo.path)).toEqual([
      ['Query.usersPage', 'User.posts'],
    ]);
    expect(capturedPaths[0].segments[0]).toEqual({
      field: 'usersPage',
      alias: 'usersPage',
      parentType: 'Query',
      isList: false,
    });
  });
});
