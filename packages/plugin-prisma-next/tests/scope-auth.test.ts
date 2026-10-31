import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute, type GraphQLSchema, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import {
  type CapturedExecution,
  createSqliteRuntime,
  createTestRuntime,
  loadContract,
  type SampleContract,
  type SqliteRuntime,
  type TestRuntimeContext,
  withCapture,
} from './fixtures/runtime';
import type { Contract as InheritanceContract } from './inheritance/contract';

let ctx: TestRuntimeContext;
let inheritanceDb: SqliteRuntime<InheritanceContract>;
beforeAll(async () => {
  ctx = await createTestRuntime();
  inheritanceDb = createSqliteRuntime(
    loadContract<InheritanceContract>(new URL('./inheritance/contract.json', import.meta.url)),
    `
    CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
    CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT, reviewerId TEXT);
    CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL);
    INSERT INTO user VALUES ('u1', 'a@example.com');
    INSERT INTO task VALUES ('t1', 'bug1', 'bug', 'u1', 'high', 'u1'), ('t2', 'feat1', 'feature', 'u1', NULL, 'u1');
    INSERT INTO feature VALUES ('t2', 5);
  `,
  );
});
afterAll(async () => {
  await ctx?.cleanup();
  await inheritanceDb?.cleanup();
});

async function runCaptured(schema: GraphQLSchema, source: string) {
  const statements: CapturedExecution[] = [];
  const result = await withCapture(statements, async () =>
    execute({ schema, document: parse(source), contextValue: {} }),
  );
  // biome-ignore lint/suspicious/noExplicitAny: assertions walk arbitrary response data
  return { ...result, data: result.data as any, statements };
}

function schema() {
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
    Context: { admin: boolean };
    AuthScopes: { admin: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: ({ admin }) => ({ admin }) },
    prismaNext: { client: ctx.client },
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      email: t.withAuth({ admin: true }).exposeString('email', { nullable: true }),
      posts: t.withAuth({ admin: true }).relation('posts', { nullable: true }),
      postCount: t.withAuth({ admin: true }).relationCount('posts', { nullable: true }),
      postConnection: t
        .withAuth({ admin: true })
        .relatedConnection('posts', { cursor: 'id', nullable: true }),
    }),
  });
  builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
  builder.queryType({
    fields: (t) => ({
      user: t.prismaField({
        type: 'User',
        resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
      }),
      privateUser: t.withAuth({ admin: true }).prismaField({
        type: 'User',
        nullable: true,
        resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
      }),
    }),
  });
  return builder.toSchema();
}

it('preserves selections and scope checks on prisma-specific field helpers', async () => {
  const result = await execute({
    schema: schema(),
    document: parse(
      '{ user { email posts { title } postCount postConnection(first: 1) { edges { node { title } } } } }',
    ),
    contextValue: { admin: true },
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    user: {
      email: 'alice@example.com',
      posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }],
      postCount: 2,
      postConnection: { edges: [{ node: { title: 'Draft #1' } }] },
    },
  });
});

it('denies protected model fields without affecting the public sibling', async () => {
  const result = await execute({
    schema: schema(),
    document: parse(
      '{ user { firstName email posts { title } postCount postConnection { edges { node { title } } } } }',
    ),
    contextValue: { admin: false },
  });
  expect(result.errors).toHaveLength(4);
  expect(result.data).toEqual({
    user: {
      firstName: 'Alice',
      email: null,
      posts: null,
      postCount: null,
      postConnection: null,
    },
  });
});

it('does not execute the root collection when a root scope denies access', async () => {
  const statements: CapturedExecution[] = [];
  const result = await withCapture(statements, async () =>
    execute({
      schema: schema(),
      document: parse('{ privateUser { firstName } }'),
      contextValue: { admin: false },
    }),
  );
  expect(result.errors).toHaveLength(1);
  expect(result.data).toEqual({ privateUser: null });
  expect(statements).toHaveLength(0);
});

function _narrowedParentShapeSurvivesWithAuth() {
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
    Context: { admin: boolean };
    AuthScopes: { admin: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: ({ admin }) => ({ admin }) },
    prismaNext: { client: ctx.client },
  });

  builder.prismaObjectFields('User', (t) => ({
    declaredBehindScope: t.withAuth({ admin: true }).string({
      select: ['email'],
      resolve: (row) => row.email,
    }),
    undeclaredBehindScope: t.withAuth({ admin: true }).string({
      // @ts-expect-error The string form's parent carries only declared dependencies.
      resolve: (row) => row.email,
    }),
  }));
}

it('loads declared columns and the exposed column for authScopes', async () => {
  const seen: Record<string, unknown> = {};
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
    AuthScopes: { open: boolean };
  }>({
    plugins: [ScopeAuthPlugin, RelayPlugin, prismaNextPlugin],
    relay: {},
    scopeAuth: { authScopes: () => ({ open: true }) },
    prismaNext: { client: ctx.client },
  });
  builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
  builder.prismaObject('User', {
    select: ['email'],
    fields: (t) => ({
      posts: t.relation('posts', {
        authScopes: (user) => {
          seen.relationEmail = user.email;
          return true;
        },
      }),
      firstName: t.exposeString('firstName', {
        authScopes: (user) => {
          seen.exposedOwn = user.firstName;
          seen.exposedDeclared = user.email;
          // @ts-expect-error lastName isn't loaded for this field
          seen.undeclared = user.lastName;
          return true;
        },
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
      }),
    }),
  });
  const result = await execute({
    schema: builder.toSchema(),
    document: parse('{ users { firstName posts { id } } }'),
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(seen).toEqual({
    relationEmail: 'alice@example.com',
    exposedOwn: 'Alice',
    exposedDeclared: 'alice@example.com',
    undeclared: undefined,
  });
});

const orders = [
  ['scope-auth first', [ScopeAuthPlugin, prismaNextPlugin]],
  ['prismaNext first', [prismaNextPlugin, ScopeAuthPlugin]],
] as const;

describe.each(orders)("an implementation's select under an interface (%s)", (_, plugins) => {
  function variantSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaNextContract: InheritanceContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: inheritanceDb.client },
    });
    const Task = builder.prismaInterface('Task', {
      fields: (t) => ({ title: t.exposeString('title', { nullable: true }) }),
    });
    builder.prismaObject('Bug', {
      interfaces: [Task],
      select: ['severity'],
      authScopes: (bug) => {
        seen.push(bug.severity);
        return bug.severity !== 'high';
      },
    });
    builder.prismaObject('Feature', {
      interfaces: [Task],
      select: ['priority'],
      authScopes: (feature) => {
        seen.push(feature.priority);
        return feature.priority === 5;
      },
    });
    builder.prismaObject('User', { fields: (t) => ({ tasks: t.relation('tasks') }) });
    builder.queryType({
      fields: (t) => ({
        tasks: t.prismaField({
          type: [Task],
          resolve: () => inheritanceDb.orm.Task.orderBy((row) => row.id.asc()),
        }),
        users: t.prismaField({ type: ['User'], resolve: () => inheritanceDb.orm.User }),
      }),
    });
    return builder.toSchema();
  }

  it('loads variant columns that type-level authScopes read, without a fragment', async () => {
    const seen: unknown[] = [];
    const schema = variantSchema(seen);
    const result = await runCaptured(schema, '{ tasks { __typename title } }');
    expect(seen).not.toContain(undefined);
    expect(seen).toContain('high');
    expect(seen).toContain(5);
    expect(result.data).toEqual({
      tasks: [
        { __typename: 'Bug', title: null },
        { __typename: 'Feature', title: 'feat1' },
      ],
    });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for Bug',
    ]);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).toMatch(/"severity"/);
    expect(result.statements[0].sql).toMatch(/"priority"/);

    const relation = await runCaptured(schema, '{ users { tasks { title } } }');
    expect(relation.data).toEqual({ users: [{ tasks: [{ title: null }, { title: 'feat1' }] }] });
    expect(relation.statements).toHaveLength(1);
    expect(seen).not.toContain(undefined);
  });

  function sameModelSchema(seen: unknown[]) {
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: ctx.client },
    });
    const Named = builder.prismaInterface('User', {
      name: 'Named',
      resolveType: () => 'User',
      fields: (t) => ({ firstName: t.exposeString('firstName', { nullable: true }) }),
    });
    builder.prismaObject('User', {
      interfaces: [Named],
      select: { email: true, posts: true },
      authScopes: (user) => {
        seen.push(Array.isArray(user.posts) ? [user.email, user.posts.length] : user.posts);
        return user.email !== 'alice@example.com';
      },
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        named: t.prismaField({
          type: [Named],
          resolve: () => ctx.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  it("loads an implementation's columns and to-many relations for its authScopes", async () => {
    const seen: unknown[] = [];
    const result = await runCaptured(sameModelSchema(seen), '{ named { firstName } }');
    expect(result.data).toEqual({ named: [{ firstName: null }, { firstName: 'Bob' }] });
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Not authorized to read fields for User',
    ]);
    expect(seen).toEqual(
      expect.arrayContaining([
        ['alice@example.com', 2],
        ['bob@example.com', 2],
      ]),
    );
    expect(seen.every(Array.isArray)).toBe(true);
    expect(result.statements).toHaveLength(1);
  });
});

it("reloads a hand-built row for an implementation's authScopes (prismaNext first)", async () => {
  const seen: unknown[] = [];
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
    AuthScopes: { ok: boolean };
  }>({
    plugins: [prismaNextPlugin, ScopeAuthPlugin],
    scopeAuth: { authScopes: () => ({ ok: true }) },
    prismaNext: { client: ctx.client },
  });
  const Named = builder.prismaInterface('User', {
    name: 'Named',
    resolveType: () => 'User',
    fields: (t) => ({ firstName: t.exposeString('firstName', { nullable: true }) }),
  });
  builder.prismaObject('User', {
    interfaces: [Named],
    select: ['email'],
    authScopes: (user) => {
      seen.push(user.email);
      return user.email !== 'alice@example.com';
    },
  });
  builder.queryType({
    fields: (t) => ({
      named: t.field({
        type: Named,
        resolve: () => ({ id: 'u-alice', firstName: 'Alice' }) as never,
      }),
    }),
  });
  const result = await runCaptured(builder.toSchema(), '{ named { firstName } }');
  expect(seen).toEqual(['alice@example.com']);
  expect(result.data).toEqual({ named: { firstName: null } });
  expect(result.statements).toHaveLength(1);
});

describe.each(
  orders,
)("a type select's to-many relation loaded through combine (%s)", (_, plugins) => {
  it('hands type-level authScopes the rows the type selects, once per parent', async () => {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
      AuthScopes: { ok: boolean };
    }>({
      plugins: [...plugins],
      scopeAuth: { authScopes: () => ({ ok: true }) },
      prismaNext: { client: ctx.client },
    });
    builder.prismaObject('User', {
      select: { posts: true },
      authScopes: (user) => {
        seen.push(
          Array.isArray(user.posts) ? user.posts.map((post) => post.title).sort() : user.posts,
        );
        return user.posts.length > 0;
      },
      fields: (t) => ({
        firstName: t.exposeString('firstName'),
        lastName: t.exposeString('lastName'),
        published: t.relation('posts', { query: { where: { published: 1 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => ctx.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await runCaptured(
      builder.toSchema(),
      '{ users { firstName lastName published { title } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [{ firstName: 'Alice', lastName: 'Andrews', published: [{ title: 'Hello, Pothos' }] }],
    });
    expect(seen).toEqual([['Draft #1', 'Hello, Pothos']]);
    expect(result.statements).toHaveLength(1);
  });
});
