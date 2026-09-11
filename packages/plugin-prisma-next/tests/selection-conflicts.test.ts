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

it('keeps independent type prerequisites while batching field overrides across parents', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
  });
  const seen: unknown[] = [];
  builder.prismaObject('Post', {
    select: { title: true, author: { where: { firstName: 'Alice' } } },
    fields: (t) => ({
      prerequisite: t.string({ resolve: (row) => row.author?.firstName ?? 'missing' }),
      label: t.string({
        nullable: true,
        select: { author: { where: { firstName: 'Bob' } } },
        resolve: (row) => {
          seen.push(row.author);
          return `${row.title}:${row.author?.firstName ?? 'missing'}`;
        },
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaField({
        type: ['Post'],
        resolve: () => ctx.ormClient.Post.orderBy((post) => post.id.asc()),
      }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ posts { prerequisite label } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(
    (result.data?.posts as { prerequisite: string; label: string }[]).map((post) => ({
      prerequisite: post.prerequisite,
      author: post.label.split(':').at(-1),
    })),
  ).toEqual([
    { prerequisite: 'missing', author: 'Bob' },
    { prerequisite: 'missing', author: 'Bob' },
    { prerequisite: 'Alice', author: 'missing' },
    { prerequisite: 'Alice', author: 'missing' },
  ]);
  expect(
    (result.data?.posts as { label: string }[]).every(
      (post) => !post.label.startsWith('undefined:'),
    ),
  ).toBe(true);
  expect(seen).toHaveLength(4);
  expect(captures).toHaveLength(2);
  expect(captures[1].params).toEqual(
    expect.arrayContaining(['p-hello', 'p-draft1', 'p-bob1', 'p-bob-draft']),
  );
});

it.each([
  false,
  true,
])('rejects function-form to-one selections clearly before SQL (provider: %s)', async (provider) => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract, ...(provider ? { collections: ctx.ormClient } : {}) },
  });
  builder.prismaObject('Post', {
    fields: (t) => ({
      label: t.string({
        select: { author: (author) => ({ rows: author.select('firstName') }) },
        resolve: () => 'unexpected',
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaField({ type: ['Post'], resolve: () => ctx.ormClient.Post }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ posts { label } }'),
    }),
  );
  expect(result.errors?.[0].message).toContain(
    'Function-form selection on to-one relation "author"',
  );
  expect(captures).toHaveLength(0);
});

it('pins the public ORM limitation even for one function-form to-one combine slot', () => {
  expect(() =>
    ctx.ormClient.Post.include('author', (author) => {
      // @ts-expect-error The public ORM also rejects to-one combines statically.
      return author.combine({ rows: author.select('firstName') });
    }),
  ).toThrowError(expect.objectContaining({ code: 'ORM.INCLUDE_UNSUPPORTED' }));
});

it.each([
  false,
  true,
])('rejects conflicting interface and concrete type prerequisites before SQL (provider: %s)', async (provider) => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract, ...(provider ? { collections: ctx.ormClient } : {}) },
  });
  const iface = builder.prismaInterface('Post', {
    name: 'PostBase',
    select: { author: { where: { firstName: 'Alice' } } },
    fields: (t) => ({ id: t.exposeID('id') }),
  });
  builder.prismaObject('Post', {
    interfaces: [iface],
    select: { author: { where: { firstName: 'Bob' } } },
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaField({ type: ['Post'], resolve: () => ctx.ormClient.Post }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ posts { id title } }'),
    }),
  );
  expect(result.errors?.[0].message).toContain('to-one and has incompatible queries');
  expect(result.errors?.[0].message).toContain(':object:PostBase:author');
  expect(result.errors?.[0].message).toContain(':object:Post:author');
  expect(captures).toHaveLength(0);
});

it('loads conflicting same-row variant prerequisites in independent multi-parent batches', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
  });
  const view = builder.prismaObject('Post', {
    name: 'BobPost',
    select: { author: { where: { firstName: 'Bob' } } },
    fields: (t) => ({ name: t.string({ resolve: (row) => row.author?.firstName ?? 'missing' }) }),
  });
  builder.prismaObject('Post', {
    select: { author: { where: { firstName: 'Alice' } } },
    fields: (t) => ({
      name: t.string({ resolve: (row) => row.author?.firstName ?? 'missing' }),
      view: t.variant(view),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaField({
        type: ['Post'],
        resolve: () => ctx.ormClient.Post.orderBy((post) => post.id.asc()),
      }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ posts { name view { name } } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data?.posts).toEqual([
    { name: 'missing', view: { name: 'Bob' } },
    { name: 'missing', view: { name: 'Bob' } },
    { name: 'Alice', view: { name: 'missing' } },
    { name: 'Alice', view: { name: 'missing' } },
  ]);
  expect(captures).toHaveLength(2);
  expect(captures[1].params).toEqual(
    expect.arrayContaining(['p-hello', 'p-draft1', 'p-bob1', 'p-bob-draft']),
  );
});
