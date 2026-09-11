import SchemaBuilder from '@pothos/core';
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
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract },
  });
  const userView = builder.prismaObject('User', {
    name: 'UserView',
    fields: (t) => ({
      posts: t.relation('posts', {
        args: { published: t.arg.int() },
        query: ({ published }) => (published == null ? {} : { where: { published } }),
      }),
    }),
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
      firstName: t.exposeString('firstName'),
      view: t.variant(userView),
      postCount: t.field({
        type: 'Int',
        args: { published: t.arg.int({ required: true }) },
        select: {
          posts: (
            sub: { where: (filter: unknown) => { count: () => unknown } },
            args: { published: number },
          ) => ({ posts: sub.where({ published: args.published }).count() }),
        },
        resolve: ((parent: { posts: number }) => parent.posts) as never,
      } as never),
      posts: t.relation('posts', {
        args: { published: t.arg.int() },
        query: ({ published }) => (published == null ? {} : { where: { published } }),
      }),
    }),
  });
  builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id'),
      author: t.relation('author'),
      alice: t.relation('author', { query: { where: { firstName: 'Alice' } } }),
      bob: t.relation('author', { query: { where: { firstName: 'Bob' } } }),
    }),
  });
  builder.prismaObject('Comment', { fields: (t) => ({ post: t.relation('post') }) });
  builder.queryType({
    fields: (t) => ({
      comments: t.prismaField({
        type: ['Comment'],
        resolve: () => ctx.ormClient.Comment.where({ id: 'c-1' }),
      }),
      posts: t.prismaField({
        type: ['Post'],
        resolve: () => ctx.ormClient.Post.where({ id: 'p-hello' }),
      }),
    }),
  });
  return builder.toSchema();
}

it('shares a to-one include across aliases with distinct nested selections', async () => {
  const result = await execute({
    schema: schema(),
    document: parse(`{
    posts { a: author { id } b: author { firstName posts { id } } }
  }`),
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      {
        a: { id: 'u-alice' },
        b: { firstName: 'Alice', posts: [{ id: 'p-hello' }, { id: 'p-draft1' }] },
      },
    ],
  });
});

it('shares equivalent declarative refinements', async () => {
  const result = await execute({
    schema: schema(),
    document: parse(`{
    posts { a: alice { id } b: alice { firstName } }
  }`),
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ posts: [{ a: { id: 'u-alice' }, b: { firstName: 'Alice' } }] });
});

it('rejects unsupported to-one refinements before executing SQL', async () => {
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: schema(),
      document: parse('{ posts { alice { id } bob { firstName } } }'),
      contextValue: {},
    }),
  );
  expect(result.errors?.[0].message).toMatch(/to-one.*incompatible.*ORM.INCLUDE_UNSUPPORTED/);
  expect(captures).toHaveLength(0);
});

it('preserves type-level relation selections for two views of one to-one row', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract },
  });
  const titles = (published: number) =>
    builder.prismaObject('User', {
      name: published ? 'PublishedAuthor' : 'DraftAuthor',
      select: { posts: { where: { published } } },
      fields: (t) => ({
        titles: t.string({
          resolve: (row) =>
            (row as { posts: { title: string }[] }).posts.map((post) => post.title).join(','),
        }),
      }),
    });
  const published = titles(1);
  const drafts = titles(0);
  builder.prismaObject('Post', {
    fields: (t) => ({
      publishedAuthor: t.relation('author', { type: published }),
      draftAuthor: t.relation('author', { type: drafts }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaField({
        type: ['Post'],
        resolve: () => ctx.ormClient.Post.where({ id: 'p-hello' }),
      }),
    }),
  });
  const result = await execute({
    schema: builder.toSchema(),
    document: parse(`{
    posts { publishedAuthor { titles } draftAuthor { titles } }
  }`),
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      {
        publishedAuthor: { titles: 'Hello, Pothos' },
        draftAuthor: { titles: 'Draft #1' },
      },
    ],
  });
});

it('keeps identical child aliases independent beneath shared to-one consumers', async () => {
  const result = await execute({
    schema: schema(),
    contextValue: {},
    document: parse(`{
    posts {
      a: author { posts(published: 1) { id } }
      b: author { posts(published: 0) { id } }
    }
  }`),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      {
        a: { posts: [{ id: 'p-hello' }] },
        b: { posts: [{ id: 'p-draft1' }] },
      },
    ],
  });
});

it('keeps scoped child aliases independent through further shared to-one relations', async () => {
  const result = await execute({
    schema: schema(),
    contextValue: {},
    document: parse(`{
    posts {
      a: author { posts { a: author { posts(published: 1) { id } } b: author { posts(published: 0) { id } } } }
      b: author { posts(published: 0) { id } }
    }
  }`),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      {
        a: {
          posts: [0, 1].map(() => ({
            a: { posts: [{ id: 'p-hello' }] },
            b: { posts: [{ id: 'p-draft1' }] },
          })),
        },
        b: { posts: [{ id: 'p-draft1' }] },
      },
    ],
  });
});

it('routes child aliases through same-row variant wrappers', async () => {
  const result = await execute({
    schema: schema(),
    contextValue: {},
    document: parse(`{
    posts {
      a: author { view { posts(published: 1) { id } } }
      b: author { view { posts(published: 0) { id } } }
    }
  }`),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      {
        a: { view: { posts: [{ id: 'p-hello' }] } },
        b: { view: { posts: [{ id: 'p-draft1' }] } },
      },
    ],
  });
});

it('keeps function-form child consumers independent beneath shared to-one aliases', async () => {
  const result = await execute({
    schema: schema(),
    contextValue: {},
    document: parse(`{
    posts { a: author { postCount(published: 1) } b: author { postCount(published: 9) } }
  }`),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ posts: [{ a: { postCount: 1 }, b: { postCount: 0 } }] });
});

it('carries explicit scopes across consecutive to-one includes', async () => {
  const result = await execute({
    schema: schema(),
    contextValue: {},
    document: parse(`{
    comments {
      a: post { author { posts(published: 1) { id } } }
      b: post { author { posts(published: 0) { id } } }
    }
  }`),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    comments: [
      {
        a: { author: { posts: [{ id: 'p-hello' }] } },
        b: { author: { posts: [{ id: 'p-draft1' }] } },
      },
    ],
  });
});

it('uses local child namespaces after a single-consumer to-one include', async () => {
  const result = await execute({
    schema: schema(),
    contextValue: {},
    document: parse(`{
    comments { post {
      a: author { posts(published: 1) { id } }
      b: author { posts(published: 0) { id } }
    } }
  }`),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    comments: [
      {
        post: {
          a: { posts: [{ id: 'p-hello' }] },
          b: { posts: [{ id: 'p-draft1' }] },
        },
      },
    ],
  });
});
