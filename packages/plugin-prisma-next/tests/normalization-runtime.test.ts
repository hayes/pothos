import SchemaBuilder from '@pothos/core';
import relayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, expect, it } from 'vitest';
import prismaNextPlugin, { type RelationRefinementCollection } from '../src';
import {
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;
beforeAll(async () => {
  ctx = await createTestRuntime();
});
afterAll(async () => {
  await ctx?.cleanup();
});

it('preserves filtered aliases alongside object-level relation rows', async () => {
  const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract },
  });
  b.prismaObject('User', {
    select: { posts: true },
    fields: (t) => ({
      id: t.exposeID('id'),
      total: t.int({ resolve: (p) => p.posts.length }),
      latest: t.relation('posts', { query: { orderBy: (p) => p.createdAt.desc(), limit: 1 } }),
      posts: t.relation('posts', {
        query: { where: { published: 1 }, orderBy: (p) => p.id.desc(), limit: 1 },
      }),
    }),
  });
  b.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
  b.queryType({
    fields: (t) => ({
      users: t.prismaField({ type: ['User'], resolve: (() => ctx.ormClient.User) as never }),
    }),
  });
  const result = await execute({
    schema: b.toSchema(),
    contextValue: {},
    document: parse('{ users { id total latest { id } a: posts { id } b: posts { id } } }'),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    users: [
      {
        id: 'u-alice',
        total: 2,
        latest: [{ id: 'p-draft1' }],
        a: [{ id: 'p-hello' }],
        b: [{ id: 'p-hello' }],
      },
      {
        id: 'u-bob',
        total: 2,
        latest: [{ id: 'p-bob-draft' }],
        a: [{ id: 'p-bob1' }],
        b: [{ id: 'p-bob1' }],
      },
    ],
  });
});

it('normalizes computed counts across connection, nested relation and node loading boundaries', async () => {
  const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin, relayPlugin],
    relay: {},
    prismaNext: { contract: ctx.contract },
  });
  b.prismaNode('User', {
    isTypeOf: () => true,
    id: { field: 'id' },
    collection: ctx.ormClient.User,
    select: {
      posts: (
        sub: RelationRefinementCollection<
          PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: SampleContract }>,
          'User',
          'posts'
        >,
      ) => ({ total: sub.count() }),
    },
    fields: (t) => ({
      total: t.int({ resolve: (p) => (p as typeof p & { total: number }).total }),
      postsPage: t.relatedConnection('posts', {
        cursor: 'id',
        where: { published: 1 },
        totalCount: true,
      }),
    }),
  });
  b.prismaObject('Post', {
    select: {
      comments: (
        sub: RelationRefinementCollection<
          PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: SampleContract }>,
          'Post',
          'comments'
        >,
      ) => ({ commentsTotal: sub.count() }),
    },
    fields: (t) => ({
      author: t.relation('author'),
      commentsTotal: t.int({ resolve: (p) => p.commentsTotal }),
    }),
  });
  b.queryType({
    fields: (t) => ({
      users: t.prismaField({ type: ['User'], resolve: (() => ctx.ormClient.User) as never }),
      posts: t.prismaField({ type: ['Post'], resolve: (() => ctx.ormClient.Post) as never }),
      page: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        totalCount: true,
        resolve: (() => ctx.ormClient.User) as never,
      }),
    }),
  });
  const id = Buffer.from('User:u-alice').toString('base64');
  const result = await execute({
    schema: b.toSchema(),
    contextValue: {},
    document: parse(
      `{ users { total postsPage(first: 1) { totalCount edges { node { commentsTotal } } } } posts { author { total } } page(first: 1) { totalCount edges { node { total } } } node(id: "${id}") { ... on User { total } } }`,
    ),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    users: [
      { total: 2, postsPage: { totalCount: 1, edges: [{ node: { commentsTotal: 2 } }] } },
      { total: 2, postsPage: { totalCount: 1, edges: [{ node: { commentsTotal: 0 } }] } },
    ],
    posts: Array.from({ length: 4 }, () => ({ author: { total: 2 } })),
    page: { totalCount: 2, edges: [{ node: { total: 2 } }] },
    node: { total: 2 },
  });
});

it('keeps frozen shared rows intact and ordinary resolvers synchronous', () => {
  const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract },
  });
  const rows = Object.freeze([{ id: 'p-hello' }, { id: 'p-draft1' }]);
  const slots = Object.freeze({
    ':object:User:posts': rows,
    ':object:UserVariant:posts': rows.slice(0, 1),
    'chosen:posts': rows.slice(0, 1),
  });
  const parent = Object.freeze({ id: 'u-alice', posts: slots });
  const variant = b.prismaObject('User', {
    name: 'UserVariant',
    select: { posts: true },
    fields: (t) => ({ total: t.int({ resolve: (p) => p.posts.length }) }),
  });
  const user = b.prismaObject('User', {
    select: { posts: true },
    fields: (t) => ({
      total: t.int({ resolve: (p) => p.posts.length }),
      posts: t.relation('posts'),
      variant: t.variant(variant),
    }),
  });
  b.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
  b.queryType({
    fields: (t) => ({ user: t.field({ type: user, resolve: () => parent as never }) }),
  });
  const result = execute({
    schema: b.toSchema(),
    contextValue: {},
    document: parse('{ user { total chosen: posts { id } variant { total } } }'),
  });
  expect(result).not.toBeInstanceOf(Promise);
  expect(result).toEqual({
    data: { user: { total: 2, chosen: [{ id: 'p-hello' }], variant: { total: 1 } } },
  });
  expect(parent.posts).toBe(slots);
  expect(Object.keys(parent)).toEqual(['id', 'posts']);
});

it.each([
  ['id'] as const,
  { id: true } as const,
])('preserves row identity for scalar-only type selects %j', (select) => {
  const parent = { id: 'u-alice' };
  const labels = new WeakMap([[parent, 'cached label']]);
  const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract },
  });
  const user = b.prismaObject('User', {
    select,
    fields: (t) => ({ label: t.string({ resolve: (p) => labels.get(p) }) }),
  });
  b.queryType({
    fields: (t) => ({ user: t.field({ type: user, resolve: () => parent as never }) }),
  });
  const result = execute({
    schema: b.toSchema(),
    contextValue: {},
    document: parse('{ user { label } }'),
  });
  expect(result).not.toBeInstanceOf(Promise);
  expect(result).toEqual({ data: { user: { label: 'cached label' } } });
});
