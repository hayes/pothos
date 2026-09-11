import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, expect, it } from 'vitest';
import prismaNextPlugin, { applySelectionToCollection } from '../src';
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
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [ErrorsPlugin, RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      name: t.exposeString('firstName'),
      posts: t.relation('posts', { query: { where: { published: 1 } } }),
    }),
  });
  const post = builder.prismaObject('Post', {
    fields: (t) => ({
      title: t.exposeString('title'),
      label: t.string({ resolve: () => 'Post' }),
      author: t.relation('author'),
      alice: t.relation('author', {
        nullable: true,
        query: { where: { firstName: 'Alice' } },
      }),
      bob: t.relation('author', {
        nullable: true,
        query: { where: { firstName: 'Bob' } },
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        resolve: () => ctx.ormClient.Post.where({ authorId: 'u-alice' }),
      }),
      wrapped: t.prismaField({
        type: ['Post'],
        errors: { types: [] },
        resolve: () => ctx.ormClient.Post.where({ authorId: 'u-alice' }),
      }),
      manual: t.field({
        type: [post],
        resolve: async (_parent, _args, context, info) => {
          const collection = await applySelectionToCollection(
            ctx.ormClient.Post.where({ authorId: 'u-alice' }) as never,
            info,
            ctx.contract,
            context,
          );
          return (await (collection as unknown as typeof ctx.ormClient.Post).all()) as never;
        },
      }),
    }),
  });
  return builder.toSchema();
}

it('loads conflicting branches beneath a Relay connection without losing nested mappings', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      document: parse(`{
        posts(first: 2) {
          edges { node {
            bob { name }
            alice { name posts { title author { name } } }
          } }
        }
      }`),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: {
      edges: [0, 1].map(() => ({
        node: {
          bob: null,
          alice: {
            name: 'Alice',
            posts: [{ title: 'Hello, Pothos', author: { name: 'Alice' } }],
          },
        },
      })),
    },
  });
  // The second branch is one multi-parent reload, including its whole subtree.
  expect(captures).toHaveLength(2);
});

it('does not reload fields with no declared selection dependencies', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      document: parse(`{
        wrapped { ... on QueryWrappedSuccess { data { label } } }
      }`),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ wrapped: { data: [{ label: 'Post' }, { label: 'Post' }] } });
  expect(captures).toHaveLength(1);
});

it('recognizes selections already loaded through the public helper', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      document: parse('{ manual { title label author { name } } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    manual: [
      { title: 'Hello, Pothos', label: 'Post', author: { name: 'Alice' } },
      { title: 'Draft #1', label: 'Post', author: { name: 'Alice' } },
    ],
  });
  expect(captures).toHaveLength(1);
});

it.each([
  {},
  { id: 'u-alice' },
])('resolves dependency-free fields without loading parent %j', async (parent) => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
  });
  const user = builder.prismaObject('User', {
    fields: (t) => ({ constant: t.string({ resolve: () => 'constant' }) }),
  });
  builder.queryType({
    fields: (t) => ({ user: t.field({ type: user, resolve: () => parent as never }) }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, () => {
    const execution = execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ user { constant } }'),
    });
    expect(execution).not.toBeInstanceOf(Promise);
    return Promise.resolve(execution);
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ user: { constant: 'constant' } });
  expect(captures).toHaveLength(0);
});

it.each([
  ['id'] as const,
  { id: true } as const,
])('preserves preloaded parent identity with scalar type selection %j', async (select) => {
  const labels = new WeakMap<object, string>();
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
  });
  const user = builder.prismaObject('User', {
    select,
    fields: (t) => ({ label: t.string({ resolve: (parent) => labels.get(parent) }) }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.field({
        type: [user],
        resolve: async (_parent, _args, context, info) => {
          const collection = await applySelectionToCollection(
            ctx.ormClient.User as never,
            info,
            ctx.contract,
            context,
          );
          const rows = await (collection as unknown as typeof ctx.ormClient.User).all();
          for (const row of rows) {
            labels.set(row, 'cached label');
          }
          return rows as never;
        },
      }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ users { label } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ users: [{ label: 'cached label' }, { label: 'cached label' }] });
  expect(captures).toHaveLength(1);
});

it('loads inherited type prerequisites for fields without their own selection', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
  });
  const named = builder.prismaInterface('User', {
    name: 'NamedUser',
    select: ['firstName'],
    fields: (t) => ({ name: t.string({ resolve: (parent) => parent.firstName }) }),
  });
  const user = builder.prismaObject('User', { interfaces: [named] as never });
  builder.queryType({
    fields: (t) => ({
      user: t.field({ type: user, resolve: () => ({ id: 'u-alice' }) as never }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ user { name } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ user: { name: 'Alice' } });
  expect(captures).toHaveLength(1);
});

it('loads conflicting branches through an errors-plugin success wrapper', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      contextValue: {},
      document: parse(`{
        wrapped { ... on QueryWrappedSuccess {
          data { bob { name } alice { name } }
        } }
      }`),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    wrapped: { data: [0, 1].map(() => ({ bob: null, alice: { name: 'Alice' } })) },
  });
  expect(captures).toHaveLength(2);
});
