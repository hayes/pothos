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

// Object-form `select` lets a plain `t.field` declare relation includes
// alongside column reads. The plugin namespaces the combine slot per
// field (alias `<graphqlAlias>:<specKey>`) so the same relation can be
// loaded by multiple consumers (sugar method + object-form select +
// other fields) without collision. The per-field wrap remaps the
// namespaced slot back onto `parent[specKey]` before the user resolver
// runs, so resolvers never see the namespace.
describe('object-level select on prismaObject', () => {
  function buildSchema() {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });

    // Object-level select: every User row gets `posts` and `comments`
    // loaded by default, visible to any field's resolver via the
    // source-row normalize wrap.
    builder.prismaObject('User', {
      select: { posts: true, comments: true },
      fields: (t) => ({
        id: t.exposeID('id'),
        // Plain t.field reading the object-level loaded relations.
        // No field-level select — relies on object-level normalization
        // and the prismaObject's `Shape` being widened from `select`.
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
      Promise.resolve(execute({ schema: buildSchema(), document: parse(query) })),
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
        // Plain t.field declaring an object-form select that loads the
        // `posts` relation. Resolver reads `parent.posts` directly —
        // the plugin's per-field wrap has already overlaid the right
        // combine slot before invoking us.
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
        // Function-form: refined include + scalar in one spec object.
        // Inner keys become parent properties via the overlay wrap.
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
        // Function-form alongside a simple-include on the same relation
        // — both fields touch `posts` with different filters; each
        // resolver sees only its own overlay.
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
      Promise.resolve(execute({ schema: buildSchema(), document: parse(query) })),
    );
    return { result, captures };
  }

  it('loads a relation declared via object-form select and exposes it to the resolver', async () => {
    const { result } = await runQuery('{ users { id postTitlesJoined } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: { id: string; postTitlesJoined: string }[] };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice).toBeDefined();
    // Sample contract has 4 posts total for Alice (drafts + published).
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
    // Three consumers on `posts`: sugar relation (all posts), draftCount (count of unpublished),
    // publishedSummary (rows + count of published). All overlays are independent.
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
    // firstPostTitle is read via the namespaced overlay; sugar `posts`
    // is read directly off `parent[relationName]`. Both see their own
    // copy of the posts data.
    expect(alice?.firstPostTitle).toBe(alice?.posts[0]?.title);
  });
});
