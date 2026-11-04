import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

// `t.withAuth` on a drizzle object's field builder: the fields it builds carry the scopes, and the
// drizzle-specific methods (`relation`, `relatedConnection`) still select their data.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { allowed: boolean };
  AuthScopes: { allowed: boolean };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: {
    authScopes: (ctx) => ({ allowed: ctx.allowed }),
    treatErrorsAsUnauthorized: true,
  },
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({ id: t.exposeID('postId') }),
});

const User = builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    firstName: t.withAuth({ allowed: true }).exposeString('firstName', { nullable: true }),
    posts: t.withAuth({ allowed: true }).relation('posts', { nullable: true }),
    postsConnection: t.withAuth({ allowed: true }).relatedConnection('posts', { nullable: true }),
    // a field's own `authScopes` replace the ones from `withAuth`, as in scope-auth and prisma
    username: t.withAuth({ allowed: true }).exposeString('username', { authScopes: () => true }),
  }),
});

builder.queryType({
  fields: (t) => ({
    users: t.drizzleConnection({
      type: User,
      resolve: (query) => db.query.users.findMany(query()),
    }),
  }),
});

const schema = builder.toSchema({});

const document = gql`
  query {
    users(first: 1) {
      edges {
        node {
          firstName
          username
          posts {
            id
          }
          postsConnection(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  }
`;

it('resolves withAuth fields on a drizzle object when the scope passes', async () => {
  const [user] = await db.query.users.findMany({
    limit: 1,
    orderBy: { id: 'asc' },
    with: { posts: { columns: { postId: true } } },
  });

  const result = await execute({ schema, document, contextValue: { allowed: true } });

  expect(result.errors).toBeUndefined();

  const [{ node }] = (
    result.data as {
      users: {
        edges: {
          node: {
            firstName: string | null;
            posts: { id: string }[];
            postsConnection: { edges: unknown[] };
          };
        }[];
      };
    }
  ).users.edges;

  expect(user.posts.length).toBeGreaterThan(0);
  expect(node.firstName).toBe(user.firstName);
  expect(node.posts.map((post) => post.id)).toEqual(user.posts.map((post) => String(post.postId)));
  expect(node.postsConnection.edges).toHaveLength(Math.min(user.posts.length, 1));
});

it('rejects withAuth fields on a drizzle object when the scope fails', async () => {
  const [user] = await db.query.users.findMany({ limit: 1, orderBy: { id: 'asc' } });
  const result = await execute({ schema, document, contextValue: { allowed: false } });

  expect(result.errors?.map((error) => error.message)).toEqual([
    'Not authorized to resolve User.firstName',
    'Not authorized to resolve User.posts',
    'Not authorized to resolve User.postsConnection',
  ]);
  expect(result.data).toEqual({
    users: {
      edges: [
        {
          node: { firstName: null, username: user.username, posts: null, postsConnection: null },
        },
      ],
    },
  });
});
