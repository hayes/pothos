import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import {
  type CapturedExecution,
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
  withCapture,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;
beforeAll(async () => {
  ctx = await createTestRuntime();
});
afterAll(async () => {
  await ctx?.cleanup();
});

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
