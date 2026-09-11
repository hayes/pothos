import SchemaBuilder from '@pothos/core';
import Relay from '@pothos/plugin-relay';
import {
  execute,
  experimentalExecuteIncrementally,
  GraphQLDeferDirective,
  parse,
  specifiedDirectives,
} from 'graphql';
import { expect, it } from 'vitest';
import plugin from '../src';
import {
  type CapturedExecution,
  createTestRuntime,
  type SampleContract,
  withCapture,
} from './fixtures/runtime';

it('keeps different variant field definitions independent in fallback batches', async () => {
  const ctx = await createTestRuntime();
  try {
    const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [plugin],
      prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
    });
    const one = b.prismaObject('User', {
      variant: 'One',
      fields: (t) => ({ count: t.relationCount('posts', { where: { published: 1 } }) }),
    });
    const zero = b.prismaObject('User', {
      variant: 'Zero',
      fields: (t) => ({ count: t.relationCount('posts', { where: { published: 9 } }) }),
    });
    const parents = () => [{ id: 'u-alice' }, { id: 'u-bob' }] as never;
    b.queryType({
      fields: (t) => ({
        one: t.field({ type: [one], resolve: parents }),
        zero: t.field({ type: [zero], resolve: parents }),
      }),
    });
    const captures: CapturedExecution[] = [];
    const result = await withCapture(captures, async () =>
      execute({
        schema: b.toSchema(),
        contextValue: {},
        document: parse('{ one { count } again: one { count } zero { count } }'),
      }),
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      one: [{ count: 1 }, { count: 1 }],
      again: [{ count: 1 }, { count: 1 }],
      zero: [{ count: 0 }, { count: 0 }],
    });
    // Two distinct definitions need two batches; repeated paths and parents do not.
    expect(captures).toHaveLength(2);
    for (const capture of captures) {
      expect(capture.params).toEqual(expect.arrayContaining(['u-alice', 'u-bob']));
    }
  } finally {
    await ctx.cleanup();
  }
});

it('keeps path-local aliases independent when ordinary prismaFields defer their selections', async () => {
  const ctx = await createTestRuntime();
  try {
    const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [plugin],
      prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
    });
    b.prismaObject('User', {
      fields: (t) => ({
        published: t.relationCount('posts', { where: { published: 1 } }),
        missing: t.relationCount('posts', { where: { published: 9 } }),
      }),
    });
    b.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          resolve: () => ctx.ormClient.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await experimentalExecuteIncrementally({
      schema: b.toSchema({ directives: [...specifiedDirectives, GraphQLDeferDirective] }),
      contextValue: {},
      document: parse(
        '{one:user{... @defer {count:published}} zero:user{... @defer {count:missing}}}',
      ),
    });
    if (!('initialResult' in result)) {
      throw new Error('expected incremental');
    }
    const patches = [];
    for await (const patch of result.subsequentResults) {
      patches.push(...(patch.incremental ?? []).map((p) => ('data' in p ? p.data : null)));
    }
    expect(patches).toEqual([{ count: 1 }, { count: 0 }]);
  } finally {
    await ctx.cleanup();
  }
});
it('keeps declarative variant relation filters independent in fallback batches', async () => {
  const ctx = await createTestRuntime();
  try {
    const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [plugin],
      prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
    });
    b.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    const one = b.prismaObject('User', {
      variant: 'One',
      fields: (t) => ({ posts: t.relation('posts', { query: { where: { published: 1 } } }) }),
    });
    const zero = b.prismaObject('User', {
      variant: 'Zero',
      fields: (t) => ({ posts: t.relation('posts', { query: { where: { published: 9 } } }) }),
    });
    b.queryType({
      fields: (t) => ({
        one: t.field({ type: one, resolve: () => ({ id: 'u-alice' }) as never }),
        zero: t.field({ type: zero, resolve: () => ({ id: 'u-alice' }) as never }),
      }),
    });
    const result = await execute({
      schema: b.toSchema(),
      contextValue: {},
      document: parse('{one{posts{title}} zero{posts{title}}}'),
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      one: { posts: [{ title: 'Hello, Pothos' }] },
      zero: { posts: [] },
    });
  } finally {
    await ctx.cleanup();
  }
});

it('preserves nested field definitions while merging the same outer relation', async () => {
  const ctx = await createTestRuntime();
  try {
    const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [plugin],
      prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
    });
    const user = b.prismaObject('User', {
      fields: (t) => ({
        published: t.relationCount('posts', { where: { published: 1 } }),
        missing: t.relationCount('posts', { where: { published: 9 } }),
      }),
    });
    const post = b.prismaObject('Post', {
      fields: (t) => ({ author: t.relation('author', { type: user }) }),
    });
    b.queryType({
      fields: (t) => ({
        posts: t.field({
          type: [post],
          resolve: () => [{ id: 'p-hello' }, { id: 'p-draft1' }] as never,
        }),
      }),
    });
    const captures: CapturedExecution[] = [];
    const result = await withCapture(captures, async () =>
      execute({
        schema: b.toSchema(),
        contextValue: {},
        document: parse(
          '{ one: posts { author { count: published } } zero: posts { author { count: missing } } }',
        ),
      }),
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      one: [{ author: { count: 1 } }, { author: { count: 1 } }],
      zero: [{ author: { count: 0 } }, { author: { count: 0 } }],
    });
    expect(captures).toHaveLength(2);
  } finally {
    await ctx.cleanup();
  }
});

it('separates count-only connections with different args across fallback paths', async () => {
  const ctx = await createTestRuntime();
  try {
    const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [Relay, plugin],
      prismaNext: { contract: ctx.contract, collections: ctx.ormClient },
    });
    b.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    const user = b.prismaObject('User', {
      fields: (t) => ({
        posts: t.relatedConnection('posts', {
          cursor: 'id',
          totalCount: true,
          args: { published: t.arg.int({ required: true }) },
          where: (p, a) => p.published.eq(a.published),
        }),
      }),
    });
    b.queryType({
      fields: (t) => ({
        user: t.field({ type: user, resolve: () => ({ id: 'u-alice' }) as never }),
      }),
    });
    const result = await execute({
      schema: b.toSchema(),
      contextValue: {},
      document: parse(
        '{one:user{posts(published:1){totalCount}} zero:user{posts(published:9){totalCount}}}',
      ),
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      one: { posts: { totalCount: 1 } },
      zero: { posts: { totalCount: 0 } },
    });
  } finally {
    await ctx.cleanup();
  }
});
