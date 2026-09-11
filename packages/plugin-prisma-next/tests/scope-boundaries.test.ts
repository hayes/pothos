import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
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

function schema(directResult = false, dataName = 'data', staticFilters = false) {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [ErrorsPlugin, prismaNextPlugin],
    prismaNext: { contract: ctx.contract },
  });
  const userView = builder.prismaObject('User', {
    name: 'UserView',
    fields: (t) => ({
      posts: t.relation('posts', {
        args: { published: t.arg.int() },
        query: ({ published }) =>
          staticFilters
            ? { where: { published: 0 } }
            : published == null
              ? {}
              : { where: { published } },
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
        query: ({ published }) =>
          staticFilters
            ? { where: { published: 1 } }
            : published == null
              ? {}
              : { where: { published } },
      }),
    }),
  });
  builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id'),
      author: t.relation('author', {
        errors: { types: [], directResult, dataField: { name: dataName } },
      }),
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

it.each([
  false,
  true,
])('errors directResult=%s plus list reset and nested aliases', async (direct) => {
  const wrap = (body: string) =>
    direct ? `... on User { ${body} }` : `... on PostAuthorSuccess { payload:data { ${body} } }`;
  const inner = wrap('posts(published:1){id}');
  const outer = wrap(`posts { x:author {${inner}} y:author {${wrap('posts(published:0){id}')}} }`);
  const result = await execute({
    schema: schema(direct),
    contextValue: {},
    document: parse(`{posts { a:author {${outer}} b:author {${wrap('posts(published:0){id}')}} }}`),
  });
  expect(result.errors).toBeUndefined();
  const rows = [
    {
      x: direct ? { posts: [{ id: 'p-hello' }] } : { payload: { posts: [{ id: 'p-hello' }] } },
      y: direct ? { posts: [{ id: 'p-draft1' }] } : { payload: { posts: [{ id: 'p-draft1' }] } },
    },
  ];
  expect(result.data).toEqual({
    posts: [
      {
        a: direct ? { posts: [...rows, ...rows] } : { payload: { posts: [...rows, ...rows] } },
        b: direct ? { posts: [{ id: 'p-draft1' }] } : { payload: { posts: [{ id: 'p-draft1' }] } },
      },
    ],
  });
});
it('renamed errors dataField retains scope', async () => {
  const result = await execute({
    schema: schema(false, 'value'),
    contextValue: {},
    document: parse(
      '{posts {a:author {... on PostAuthorSuccess {v:value {posts(published:1){id}}}} b:author {... on PostAuthorSuccess {v:value {posts(published:0){id}}}}}}',
    ),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      { a: { v: { posts: [{ id: 'p-hello' }] } }, b: { v: { posts: [{ id: 'p-draft1' }] } } },
    ],
  });
});

it('same-row variants preserve separate child arguments', async () => {
  const result = await execute({
    schema: schema(),
    contextValue: {},
    document: parse(`{
    posts { alice { a: view { posts(published: 1) { id } } b: view { posts(published: 0) { id } } } }
  }`),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      {
        alice: {
          a: { posts: [{ id: 'p-hello' }] },
          b: { posts: [{ id: 'p-draft1' }] },
        },
      },
    ],
  });
});

it('same-row variants preserve separate static refinements from the base type', async () => {
  const result = await execute({
    schema: schema(false, 'data', true),
    contextValue: {},
    document: parse(`{
    posts { alice { posts { id } view { posts { id } } } }
  }`),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      {
        alice: {
          posts: [{ id: 'p-hello' }],
          view: { posts: [{ id: 'p-draft1' }] },
        },
      },
    ],
  });
});

it('scopes same-row variants beneath errors-wrapped to-one aliases', async () => {
  const result = await execute({
    schema: schema(),
    contextValue: {},
    document: parse(`{
    posts {
      a: author { ... on PostAuthorSuccess { data { a: view { posts(published: 1) { id } } b: view { posts(published: 0) { id } } } } }
      b: author { ... on PostAuthorSuccess { data { view { posts(published: 0) { id } } } } }
    }
  }`),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: [
      {
        a: { data: { a: { posts: [{ id: 'p-hello' }] }, b: { posts: [{ id: 'p-draft1' }] } } },
        b: { data: { view: { posts: [{ id: 'p-draft1' }] } } },
      },
    ],
  });
});
