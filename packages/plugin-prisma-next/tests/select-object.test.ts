import SchemaBuilder from '@pothos/core';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('object-level select on prismaObject', () => {
  function buildSchema() {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });

    builder.prismaObject('User', {
      select: { posts: true, comments: true },
      fields: (t) => ({
        id: t.exposeID('id'),
        summary: t.string({
          resolve: (parent) => `${parent.posts.length} posts, ${parent.comments.length} comments`,
        }),
      }),
    });

    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        title: t.exposeString('title'),
      }),
    });

    builder.prismaObject('Comment', {
      fields: (t) => ({
        id: t.exposeID('id'),
        body: t.exposeString('body'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (() => ctx.ormClient.User) as never,
        }),
      }),
    });

    return builder.toSchema();
  }

  async function runQuery(query: string) {
    const captures: CapturedExecution[] = [];
    const result = await withCapture(captures, async () =>
      Promise.resolve(execute({ schema: buildSchema(), document: parse(query), contextValue: {} })),
    );
    return { result, captures };
  }

  it('loads object-level relations and exposes them on every row', async () => {
    const { result } = await runQuery('{ users { id summary } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: { id: string; summary: string }[] };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.summary).toMatch(/^\d+ posts, \d+ comments$/);
  });
});

describe('object-form select on t.field', () => {
  function buildSchema() {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });

    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        postTitlesJoined: t.string({
          select: { posts: true },
          resolve: (parent) => parent.posts.map((p) => p.title).join(', '),
        }),
        descriptor: t.string({
          select: { firstName: true, lastName: true, posts: true },
          resolve: (parent) =>
            `${parent.firstName} ${parent.lastName} (${parent.posts.length} posts)`,
        }),
        posts: t.relation('posts'),
        firstPostTitle: t.string({
          nullable: true,
          select: { posts: true },
          resolve: (parent) => parent.posts[0]?.title ?? null,
        }),
        publishedSummary: t.string({
          select: {
            posts: (sub) => ({
              published: sub.where((p) => p.published.eq(1)),
              pubCount: sub.where((p) => p.published.eq(1)).count(),
            }),
          },
          resolve: (parent) =>
            `${parent.pubCount ?? 0} published: ${parent.published.map((x) => x.title).join(', ')}`,
        }),
        draftCount: t.int({
          nullable: true,
          select: {
            posts: (sub) => ({ cnt: sub.where((p) => p.published.eq(0)).count() }),
          },
          resolve: (parent) => parent.cnt,
        }),
      }),
    });

    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        title: t.exposeString('title'),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (() => ctx.ormClient.User) as never,
        }),
      }),
    });

    return builder.toSchema();
  }

  async function runQuery(query: string) {
    const captures: CapturedExecution[] = [];
    const result = await withCapture(captures, async () =>
      Promise.resolve(execute({ schema: buildSchema(), document: parse(query), contextValue: {} })),
    );
    return { result, captures };
  }

  it('loads a relation declared via object-form select and exposes it to the resolver', async () => {
    const { result } = await runQuery('{ users { id postTitlesJoined } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: { id: string; postTitlesJoined: string }[] };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice).toBeDefined();
    expect(alice?.postTitlesJoined).toMatch(/,/);
  });

  it('mixes columns and a relation in one select spec', async () => {
    const { result } = await runQuery('{ users { id descriptor } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: { id: string; descriptor: string }[] };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.descriptor).toMatch(/^Alice \w+ \(\d+ posts\)$/);
  });

  it('function-form select with refined include + scalar in one spec', async () => {
    const { result } = await runQuery('{ users { id publishedSummary } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: { id: string; publishedSummary: string }[] };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.publishedSummary).toMatch(/^\d+ published: /);
  });

  it('function-form select coexists with sugar t.relation on the same relation', async () => {
    const { result } = await runQuery(
      '{ users { id posts { id title } draftCount publishedSummary } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        id: string;
        posts: { id: string; title: string }[];
        draftCount: number;
        publishedSummary: string;
      }[];
    };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.posts.length).toBeGreaterThan(0);
    expect(typeof alice?.draftCount).toBe('number');
    expect(alice?.publishedSummary).toMatch(/published/);
  });

  it('coexists with a sugar t.relation on the same relation without collision', async () => {
    const { result } = await runQuery('{ users { id posts { id title } firstPostTitle } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        id: string;
        posts: { id: string; title: string }[];
        firstPostTitle: string | null;
      }[];
    };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.posts.length).toBeGreaterThan(0);
    expect(alice?.firstPostTitle).toBe(alice?.posts[0]?.title);
  });
});

describe('function-form select on a to-one relation', () => {
  it('reports the unsupported combine instead of resolving to undefined', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('Post', {
      fields: (t) => ({
        title: t.exposeString('title'),
        // The cast gets past the type check to reach the emitter.
        authorCount: t.relationCount('author' as never),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({ type: ['Post'], resolve: (() => ctx.ormClient.Post) as never }),
      }),
    });
    const result = await execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ posts { title authorCount } }'),
    });
    expect(result.errors?.[0]?.message).toMatch(
      /Function-form selection on to-one relation "author"/,
    );
  });
});
