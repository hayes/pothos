import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute, type GraphQLSchema, parse } from 'graphql';
import { afterAll, describe, expect, it } from 'vitest';
import PrismaNextPlugin, { collectionFromInfo } from '../src';
import {
  type CapturedExecution,
  createTestRuntime,
  type SampleContract,
  withCapture,
} from './fixtures/runtime';

// Kept out of the shared fixtures: installing scope-auth makes its options required on every
// builder, so this file type-checks in the scope-auth project with `scope-auth.test.ts`.
const db = createTestRuntime();
afterAll(() => db.cleanup());

async function run(schema: GraphQLSchema, source: string, contextValue: { signedIn: boolean }) {
  const statements: CapturedExecution[] = [];
  const result = await withCapture(statements, async () =>
    execute({ schema, document: parse(source), contextValue }),
  );
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary response data
  return { ...result, data: result.data as any, statements };
}

// Plain fields that return rows through `collectionFromInfo`, on a builder that lists the scope-auth
// plugin before this one: each loads its whole selection in one statement.
function schema() {
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
    Context: { signedIn: boolean };
    AuthScopes: { signedIn: boolean };
  }>({
    plugins: [ScopeAuthPlugin, PrismaNextPlugin],
    scopeAuth: { authScopes: ({ signedIn }) => ({ signedIn }) },
    prismaNext: { client: db.client },
  });
  const User = builder.prismaObject('User', {
    // A type-level select: every row of the type loads its comments.
    select: { comments: true },
    authScopes: { signedIn: true },
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      commentCount: t.int({ resolve: (user) => user.comments.length }),
      fullName: t.string({
        select: { firstName: true, lastName: true },
        resolve: (user) => `${user.firstName} ${user.lastName}`,
      }),
      postCount: t.relationCount('posts'),
      posts: t.relation('posts', { query: { orderBy: { id: 'asc' } } }),
    }),
  });
  builder.prismaObject('Post', {
    fields: (t) => ({ title: t.exposeString('title'), author: t.relation('author') }),
  });
  const Payload = builder
    .objectRef<{ user: typeof User.$inferType | null }>('UserPayload')
    .implement({
      fields: (t) => ({
        user: t.field({ type: User, nullable: true, resolve: (payload) => payload.user }),
      }),
    });
  builder.queryType({
    fields: (t) => ({
      user: t.field({
        type: User,
        nullable: true,
        resolve: async (_root, _args, context, info) => {
          const users = await collectionFromInfo({
            collection: db.orm.User.where({ id: 'u-alice' }),
            context,
            info,
          });
          return users.first();
        },
      }),
      users: t.field({
        type: [User],
        resolve: async (_root, _args, context, info) => {
          const users = await collectionFromInfo({
            collection: db.orm.User.orderBy((user) => user.id.asc()),
            context,
            info,
          });
          return users.all();
        },
      }),
      userPayload: t.field({
        type: Payload,
        resolve: async (_root, _args, context, info) => {
          const users = await collectionFromInfo({
            collection: db.orm.User.where({ id: 'u-bob' }),
            context,
            info,
            path: ['user'],
          });
          return { user: await users.first() };
        },
      }),
    }),
  });
  return builder.toSchema();
}

const selection = `{
  firstName
  fullName
  commentCount
  postCount
  posts { title author { firstName fullName postCount } }
}`;

const alice = {
  firstName: 'Alice',
  fullName: 'Alice Andrews',
  commentCount: 1,
  postCount: 2,
  posts: [
    {
      title: 'Draft #1',
      author: { firstName: 'Alice', fullName: 'Alice Andrews', postCount: 2 },
    },
    {
      title: 'Hello, Pothos',
      author: { firstName: 'Alice', fullName: 'Alice Andrews', postCount: 2 },
    },
  ],
};

const bob = {
  firstName: 'Bob',
  fullName: 'Bob Brown',
  commentCount: 1,
  postCount: 2,
  posts: [
    { title: 'Bob draft', author: { firstName: 'Bob', fullName: 'Bob Brown', postCount: 2 } },
    { title: 'Bob writes', author: { firstName: 'Bob', fullName: 'Bob Brown', postCount: 2 } },
  ],
};

const signedIn = { signedIn: true };

describe('collectionFromInfo with the scope-auth plugin listed first', () => {
  it('resolves a single row with nested relations in one statement', async () => {
    const result = await run(schema(), `{ user ${selection} }`, signedIn);
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual(alice);
    expect(result.statements).toHaveLength(1);
  });

  it('resolves a list with nested relations in one statement', async () => {
    const result = await run(schema(), `{ users ${selection} }`, signedIn);
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([alice, bob]);
    expect(result.statements).toHaveLength(1);
  });

  it('resolves a row in a payload through a path in one statement', async () => {
    const result = await run(schema(), `{ userPayload { user ${selection} } }`, signedIn);
    expect(result.errors).toBeUndefined();
    expect(result.data.userPayload).toEqual({ user: bob });
    expect(result.statements).toHaveLength(1);
  });

  it('still applies the type scopes to the rows', async () => {
    const result = await run(schema(), '{ user { firstName } }', { signedIn: false });
    expect(result.errors?.[0]?.message).toMatch(/Not authorized/);
    // The row loads, but the type's scopes hide its fields.
    expect(result.data).toEqual({ user: { firstName: null } });
  });
});
