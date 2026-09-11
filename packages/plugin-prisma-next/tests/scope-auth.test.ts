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
    prismaNext: { contract: ctx.contract },
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
        resolve: () => ctx.ormClient.User.where({ id: 'u-alice' }),
      }),
      privateUser: t.withAuth({ admin: true }).prismaField({
        type: 'User',
        nullable: true,
        resolve: () => ctx.ormClient.User.where({ id: 'u-alice' }),
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
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      document: parse('{ privateUser { firstName } }'),
      contextValue: { admin: false },
    }),
  );
  expect(result.errors).toHaveLength(1);
  expect(result.data).toEqual({ privateUser: null });
  expect(captures).toHaveLength(0);
});
