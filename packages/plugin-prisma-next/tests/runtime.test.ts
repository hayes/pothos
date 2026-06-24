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

function buildSchema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: {
      contract: ctx.contract,
    },
  });

  const userRef = builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
      firstName: t.exposeString('firstName'),
      lastName: t.exposeString('lastName'),
      email: t.exposeString('email'),
      // Computed field with `select` — declares which row columns the
      // resolver depends on. The mapper reads `select` and unions the
      // keys into the parent collection's `.select(...)`. The `user`
      // arg is narrowed to just `firstName | lastName` so accessing
      // un-selected columns is a TS error.
      fullName: t.string({
        select: ['firstName', 'lastName'],
        resolve: (user) => `${user.firstName} ${user.lastName}`,
      }),
      posts: t.relation('posts'),
      // The old t.relationCount sugar is gone — function-form select
      // on a plain t.field is the canonical pattern.
      postCount: t.field({
        type: 'Int',
        select: {
          posts: (sub: { count: () => unknown }) => ({ posts: sub.count() }),
        },
        resolve: ((parent: { posts: number }) => parent.posts) as never,
      } as never),
      // Filtered count — only published posts. Exercises the mapper's
      // `rel.where(...).count()` emission via function-form select.
      publishedPostCount: t.field({
        type: 'Int',
        select: {
          posts: (sub: { where: (w: unknown) => { count: () => unknown } }) => ({
            posts: sub.where({ published: 1 }).count(),
          }),
        },
        resolve: ((parent: { posts: number }) => parent.posts) as never,
      } as never),
      // Callback-form where via function-form select. The select
      // function receives (sub, args, ctx) — same plumbing the
      // walker uses for every function-form select.
      postCountByPublishedFlag: t.field({
        type: 'Int',
        args: { flag: t.arg.int({ required: true }) },
        select: {
          posts: (
            sub: { where: (w: unknown) => { count: () => unknown } },
            args: { flag: number },
          ) => ({
            posts: sub
              .where((p: { published: { eq: (v: number) => unknown } }) =>
                p.published.eq(args.flag),
              )
              .count(),
          }),
        },
        resolve: ((parent: { posts: number }) => parent.posts) as never,
      } as never),
      // Callback form for select — varies columns by an arg.
      greeting: t.string({
        args: { formal: t.arg.boolean({ required: true }) },
        select: (args) => (args.formal ? ['lastName'] : ['firstName']),
        resolve: (user, args) =>
          args.formal
            ? `Greetings, ${(user as { lastName?: string }).lastName ?? ''}`
            : `Hi, ${(user as { firstName?: string }).firstName ?? ''}`,
      }),
      // Direct t.field({ select: { posts: true }, resolve }) generalises
      // the (removed) t.relatedField — preload the relation, compute a
      // custom value from the rows.
      firstPostTitle: t.field({
        type: 'String',
        nullable: true,
        select: { posts: true },
        resolve: ((parent: { posts: { title: string }[] }) =>
          parent.posts[0]?.title ?? null) as never,
      } as never),
      // t.relationAggregate via function-form select: emit an
      // IncludeScalar (sum/avg/min/max/count) inside the parent's
      // combine spec.
      publishedPostCountAgg: t.field({
        type: 'Int',
        nullable: true,
        select: {
          posts: (sub: { where: (cb: unknown) => { count: () => unknown } }) => ({
            posts: sub
              .where((p: { published: { eq: (v: number) => unknown } }) => p.published.eq(1))
              .count(),
          }),
        },
        resolve: ((parent: { posts: number | null }) => parent.posts) as never,
      } as never),
      // Same shape but exercises ecosystem-option passthrough:
      // description + custom extensions must survive the builder's
      // destructure-and-spread.
      firstPostTitleWithMeta: t.field({
        type: 'String',
        nullable: true,
        description: 'first post title',
        extensions: { customMeta: 'rf-meta' },
        select: { posts: true },
        resolve: ((parent: { posts: { title: string }[] }) =>
          parent.posts[0]?.title ?? null) as never,
      } as never),
      // Field-level relation-aggregate sugar (t.relationCount /
      // t.relationAggregate) — thin wrappers over function-form select.
      // relationCount → number; sum/avg/min/max → number | null.
      relCount: t.relationCount('posts'),
      relCountPublished: t.relationCount('posts', { where: { published: 1 } }),
      relCountByFlag: t.relationCount('posts', {
        args: { flag: t.arg.int({ required: true }) },
        where: (p, args: { flag: number }) => p.published.eq(args.flag),
      }),
      relSumPublished: t.relationAggregate('posts', { op: 'sum', field: 'published' }),
      relMaxPublished: t.relationAggregate('posts', { op: 'max', field: 'published' }),
      relMinPublished: t.relationAggregate('posts', { op: 'min', field: 'published' }),
      // Object-form select with multiple aggregate slots in one combine.
      postStats: t.field({
        type: 'String',
        select: {
          posts: (sub: {
            count: () => unknown;
            sum: (f: string) => unknown;
            max: (f: string) => unknown;
          }) => ({
            total: sub.count(),
            sumPublished: sub.sum('published'),
            maxPublished: sub.max('published'),
          }),
        },
        resolve: ((parent: {
          total: number;
          sumPublished: number | null;
          maxPublished: number | null;
        }) =>
          `${parent.total}/${parent.sumPublished ?? 'null'}/${
            parent.maxPublished ?? 'null'
          }`) as never,
      } as never),
      comments: t.relation('comments'),
      // Sibling-aliased relations targeting the same `posts` relation
      // with different filters — exercises the mapper's combine grouping.
      drafts: t.relation('posts', {
        query: { where: (p) => p.published.eq(0) },
      }),
      publishedPosts: t.relation('posts', {
        query: { where: (p) => p.published.eq(1) },
      }),
      // Single field with args — used below to exercise GraphQL query-
      // level aliases hitting the same schema field with different args.
      postsByPublished: t.relation('posts', {
        args: { published: t.arg.int({ required: true }) },
        query: (args) => ({ where: (p) => p.published.eq(args.published) }),
      }),
    }),
  });

  builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      content: t.exposeString('content'),
      published: t.exposeInt('published'),
      author: t.relation('author'),
      comments: t.relation('comments'),
    }),
  });

  builder.prismaObject('Comment', {
    fields: (t) => ({
      id: t.exposeID('id'),
      body: t.exposeString('body'),
      author: t.relation('author'),
      post: t.relation('post'),
    }),
  });

  // Variant: a second prismaObject for the User model under a different
  // GraphQL type name. Variant carries its own field set (here, just a
  // narrow shape with `posts`). The mapper must descend through
  // `t.variant(userBasicRef)` and preload the variant's nested relations.
  const userBasicRef = builder.prismaObject('User', {
    name: 'UserBasic',
    fields: (t) => ({
      id: t.exposeID('id'),
      firstName: t.exposeString('firstName'),
      posts: t.relation('posts'),
    }),
  });
  builder.prismaObjectField('User', 'basicView', (t) => t.variant(userBasicRef));

  // Cross-file extension helpers — `prismaObjectField` adds a single
  // field to the already-registered `Comment` type without re-opening
  // the original `prismaObject` call.
  builder.prismaObjectField('Comment', 'shoutBody', (t) =>
    t.string({
      select: ['body'],
      resolve: (c) => c.body.toUpperCase(),
    }),
  );

  // `prismaObjectFields` adds multiple fields. Exercises the same path.
  builder.prismaObjectFields('User', (t) => ({
    initials: t.string({
      select: ['firstName', 'lastName'],
      resolve: (u) => `${u.firstName[0]}${u.lastName[0]}`,
    }),
  }));

  builder.queryType({
    fields: (t) => ({
      // Standard Pothos resolver signature: (parent, args, ctx, info).
      // The plugin auto-detects an orm-client Collection in the return
      // value and applies selection + materializes via `.all()`.
      users: t.prismaField({
        type: ['User'],
        resolve: (() => ctx.ormClient.User) as never,
      }),
      posts: t.prismaField({
        type: ['Post'],
        resolve: (() => ctx.ormClient.Post) as never,
      }),
      userByEmail: t.prismaField({
        type: 'User',
        nullable: true,
        args: { email: t.arg.string({ required: true }) },
        resolve: ((_parent: unknown, args: { email: string }) =>
          ctx.ormClient.User.where((u) => u.email.eq(args.email))) as never,
      }),
      // Same as `users`, but pass the ref returned by prismaObject as the
      // `type` instead of the model name string. Exercises the ref-resolution
      // path in prisma-next-field-builder.
      usersByRef: t.prismaField({
        type: [userRef],
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

describe('runtime: end-to-end against real sqlite', () => {
  it('selects scalars from a top-level prismaField', async () => {
    const { result } = await runQuery('{ users { id firstName email } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [
        { id: 'u-alice', firstName: 'Alice', email: 'alice@example.com' },
        { id: 'u-bob', firstName: 'Bob', email: 'bob@example.com' },
      ],
    });
  });

  it('exposes fields added via prismaObjectField / prismaObjectFields cross-file helpers', async () => {
    // `initials` was added via `prismaObjectFields('User', …)`; `shoutBody`
    // via `prismaObjectField('Comment', …)`. Both should resolve as if
    // declared in the original `prismaObject` `fields:` thunk.
    const { result } = await runQuery(
      '{ users { id initials posts { id comments { id shoutBody } } } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        id: string;
        initials: string;
        posts: Array<{ id: string; comments: Array<{ id: string; shoutBody: string }> }>;
      }>;
    };
    const initials = Object.fromEntries(data.users.map((u) => [u.id, u.initials]));
    expect(initials).toEqual({ 'u-alice': 'AA', 'u-bob': 'BB' });
    const helloComments = data.users
      .flatMap((u) => u.posts)
      .find((p) => p.id === 'p-hello')?.comments;
    expect(helloComments?.map((c) => c.shoutBody).sort()).toEqual([
      'GLAD TO SEE THIS WORKING.',
      'LOOKS GREAT!',
    ]);
  });

  it('accepts a PrismaNextObjectRef as t.prismaField type', async () => {
    const { result } = await runQuery('{ usersByRef { id firstName } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      usersByRef: [
        { id: 'u-alice', firstName: 'Alice' },
        { id: 'u-bob', firstName: 'Bob' },
      ],
    });
  });

  it('loads a hasMany relation in the same query', async () => {
    const { result, captures } = await runQuery('{ users { id posts { id title } } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: Array<{ id: string; posts: Array<{ id: string }> }> };
    expect(data.users).toHaveLength(2);
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.posts.map((p) => p.id).sort()).toEqual(['p-draft1', 'p-hello']);
    expect(captures).toHaveLength(1);
  });

  it('depth-2+ nested includes resolve in a single query (Issue A fixed upstream)', async () => {
    // Previously (prisma-next ≤0.7) `hasNestedIncludes` in
    // `collection-dispatch.ts` unconditionally routed any nested include
    // through `dispatchWithMultiQueryIncludes`, so depth-2
    // (`users { posts { author … } }`) emitted three SELECTs — one per
    // relation level — the N+1 fan-out. As of prisma-next 0.14.0 this is
    // fixed: the whole tree collapses into a single nested-include
    // statement. The plugin gets this for free — it only builds the
    // `.include()` tree; prisma-next picks the execution strategy.
    const { result, captures } = await runQuery(
      '{ users { id posts { id author { id firstName } } } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        id: string;
        posts: Array<{ id: string; author: { id: string; firstName: string } | null }>;
      }>;
    };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.posts[0]?.author?.firstName).toBeTruthy();

    // Single statement now — the depth-2 tree resolves in one nested SELECT.
    expect(captures.length).toBe(1);
  });

  it('exposes a function-form count() on the parent', async () => {
    const { result, captures } = await runQuery('{ users { id postCount } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: Array<{ id: string; postCount: number }> };
    const counts = Object.fromEntries(data.users.map((u) => [u.id, u.postCount]));
    expect(counts).toEqual({ 'u-alice': 2, 'u-bob': 2 });
    // Upstream short-circuit (`hasComplexIncludeDescriptors` in
    // prisma-next's orm-client) means `combine + count` falls back to
    // a multi-query plan rather than collapsing to one SQL statement.
    // Tracked as Issue B in the prisma-next handoff. When the upstream
    // fix lands, this expectation tightens to `toHaveLength(1)`.
    expect(captures.length).toBeGreaterThanOrEqual(1);
  });

  it('exposes a function-form aggregate scalar (filtered count) via t.field+select', async () => {
    // `publishedPostCountAgg` writes the aggregate inline via
    // `sub.where(p => p.published.eq(1)).count()` inside a function-
    // form `select` — same primitive used internally; any orm-client
    // scalar (count / sum / avg / min / max) flows through the same
    // mapper → combine path.
    const { result } = await runQuery('{ users { id publishedPostCountAgg } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{ id: string; publishedPostCountAgg: number | null }>;
    };
    const byId = Object.fromEntries(data.users.map((u) => [u.id, u.publishedPostCountAgg]));
    // Alice: 1 published (p-hello), 1 draft (p-draft1). Bob: 1 of each.
    expect(byId).toEqual({ 'u-alice': 1, 'u-bob': 1 });
  });

  it('t.relationCount exposes a relation row count, optionally filtered', async () => {
    const { result } = await runQuery(`{
      users {
        id
        relCount
        relCountPublished
        zero: relCountByFlag(flag: 0)
        one: relCountByFlag(flag: 1)
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        id: string;
        relCount: number;
        relCountPublished: number;
        zero: number;
        one: number;
      }>;
    };
    const byId = Object.fromEntries(
      data.users.map((u) => [
        u.id,
        { all: u.relCount, pub: u.relCountPublished, zero: u.zero, one: u.one },
      ]),
    );
    // Each user has 2 posts: 1 published (published=1), 1 draft (published=0).
    expect(byId).toEqual({
      'u-alice': { all: 2, pub: 1, zero: 1, one: 1 },
      'u-bob': { all: 2, pub: 1, zero: 1, one: 1 },
    });
  });

  it('t.relationAggregate exposes sum/min/max of a numeric relation column', async () => {
    const { result } = await runQuery(
      '{ users { id relSumPublished relMaxPublished relMinPublished } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        id: string;
        relSumPublished: number | null;
        relMaxPublished: number | null;
        relMinPublished: number | null;
      }>;
    };
    const byId = Object.fromEntries(
      data.users.map((u) => [
        u.id,
        { sum: u.relSumPublished, max: u.relMaxPublished, min: u.relMinPublished },
      ]),
    );
    // published values across each user's 2 posts: {0, 1}. sum=1, max=1, min=0.
    expect(byId).toEqual({
      'u-alice': { sum: 1, max: 1, min: 0 },
      'u-bob': { sum: 1, max: 1, min: 0 },
    });
  });

  it('object-form select emits multiple aggregate slots in one combine', async () => {
    const { result } = await runQuery('{ users { id postStats } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: Array<{ id: string; postStats: string }> };
    const byId = Object.fromEntries(data.users.map((u) => [u.id, u.postStats]));
    // total/sumPublished/maxPublished: each user has 2 posts, sum of
    // published = 1, max published = 1.
    expect(byId).toEqual({ 'u-alice': '2/1/1', 'u-bob': '2/1/1' });
  });

  it('select callback form picks columns based on field args', async () => {
    const { result: r1 } = await runQuery('{ users { id greeting(formal: false) } }');
    expect(r1.errors).toBeUndefined();
    const d1 = r1.data as { users: Array<{ id: string; greeting: string }> };
    const informal = Object.fromEntries(d1.users.map((u) => [u.id, u.greeting]));
    expect(informal['u-alice']).toBe('Hi, Alice');

    const { result: r2 } = await runQuery('{ users { id greeting(formal: true) } }');
    expect(r2.errors).toBeUndefined();
    const d2 = r2.data as { users: Array<{ id: string; greeting: string }> };
    const formal = Object.fromEntries(d2.users.map((u) => [u.id, u.greeting]));
    expect(formal['u-alice']).toBe('Greetings, Andrews');
  });

  it('t.variant preloads nested relations on the variant prismaObject (A6)', async () => {
    // Without mapper registration of the variant the nested `posts`
    // relation under `basicView` would not preload and the resolver
    // would throw "reached from a parent not loaded by t.prismaField".
    const { result, captures } = await runQuery(
      '{ users { id basicView { id firstName posts { id title } } } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        id: string;
        basicView: { id: string; firstName: string; posts: Array<{ id: string; title: string }> };
      }>;
    };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.basicView.firstName).toBe('Alice');
    expect(alice?.basicView.posts.map((p) => p.id).sort()).toEqual(['p-draft1', 'p-hello']);
    // Single query for users + variant's posts — the variant's selection
    // set merged into the parent's include just like an inline fragment.
    expect(captures).toHaveLength(1);
  });

  it('function-form t.field({ select }) passes through description + extensions to the field config (A3)', () => {
    const schema = buildSchema();
    const user = schema.getType('User') as import('graphql').GraphQLObjectType;
    const field = user.getFields().firstPostTitleWithMeta;
    expect(field).toBeDefined();
    expect(field.description).toBe('first post title');
    expect((field.extensions as Record<string, unknown>).customMeta).toBe('rf-meta');
  });

  it('t.field({ select: { rel: true } }) preloads the relation and runs a custom resolver over the rows', async () => {
    const { result } = await runQuery('{ users { id firstPostTitle } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{ id: string; firstPostTitle: string | null }>;
    };
    const titles = Object.fromEntries(data.users.map((u) => [u.id, u.firstPostTitle]));
    expect(titles['u-alice']).toBeTruthy();
    expect(titles['u-bob']).toBeTruthy();
  });

  it('function-form select where callback receives accessor + args + ctx (A1)', async () => {
    // Two aliases of the same field with different args — the mapper must
    // pass each alias's resolved args into the callback for each branch.
    const { result } = await runQuery(`{
      users {
        id
        published: postCountByPublishedFlag(flag: 1)
        drafts: postCountByPublishedFlag(flag: 0)
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{ id: string; published: number; drafts: number }>;
    };
    const byId = Object.fromEntries(data.users.map((u) => [u.id, { p: u.published, d: u.drafts }]));
    // Each user has 1 published + 1 draft post in the seed.
    expect(byId).toEqual({
      'u-alice': { p: 1, d: 1 },
      'u-bob': { p: 1, d: 1 },
    });
  });

  it('function-form count() with where filter applies the predicate before counting', async () => {
    const { result } = await runQuery('{ users { id postCount publishedPostCount } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{ id: string; postCount: number; publishedPostCount: number }>;
    };
    const counts = Object.fromEntries(
      data.users.map((u) => [u.id, { all: u.postCount, published: u.publishedPostCount }]),
    );
    // Alice has 2 posts (1 draft, 1 published), Bob has 2 (1 draft, 1 published).
    expect(counts).toEqual({
      'u-alice': { all: 2, published: 1 },
      'u-bob': { all: 2, published: 1 },
    });
  });

  it('loads a belongsTo relation in the same query', async () => {
    const { result, captures } = await runQuery('{ posts { id title author { id firstName } } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      posts: Array<{ id: string; author: { id: string; firstName: string } }>;
    };
    const helloPost = data.posts.find((p) => p.id === 'p-hello');
    expect(helloPost?.author).toEqual({ id: 'u-alice', firstName: 'Alice' });
    expect(captures).toHaveLength(1);
  });

  it('hoists computed-field `select` into the parent .select(...) call', async () => {
    const { result, captures } = await runQuery('{ users { id fullName } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [
        { id: 'u-alice', fullName: 'Alice Andrews' },
        { id: 'u-bob', fullName: 'Bob Brown' },
      ],
    });
    expect(captures).toHaveLength(1);
    // Confirm both selected columns ended up on the SQL — the SELECT
    // list should include firstName and lastName even though the
    // GraphQL query only asked for `fullName`.
    const sql = captures[0]!.sql;
    expect(sql).toMatch(/firstName/);
    expect(sql).toMatch(/lastName/);
  });

  it('runs userByEmail with a where clause', async () => {
    const { result } = await runQuery('{ userByEmail(email: "bob@example.com") { id firstName } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      userByEmail: { id: 'u-bob', firstName: 'Bob' },
    });
  });

  it('avoids N+1: 2 users + their posts in a single SQL statement', async () => {
    const { result, captures } = await runQuery('{ users { id posts { id title } } }');
    expect(result.errors).toBeUndefined();
    expect(captures).toHaveLength(1);
  });

  it('hoists depth-2 nested relations through prismaField', async () => {
    // The mapper traverses Query.users → User.posts → Post.author and
    // emits an .include('posts', rel => rel.include('author')) chain on
    // the base User collection. Data correctness is what's asserted
    // here; query count is >= 1 because depth-2 nested includes fall
    // back to multi-query upstream (Issue A in the prisma-next handoff).
    const { result, captures } = await runQuery(
      '{ users { id posts { id title author { id firstName } } } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        id: string;
        posts: Array<{ id: string; author: { id: string; firstName: string } }>;
      }>;
    };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.posts).toHaveLength(2);
    // Every post.author for Alice's posts is Alice — verifies the
    // depth-2 stitch landed correctly.
    for (const post of alice?.posts ?? []) {
      expect(post.author).toEqual({ id: 'u-alice', firstName: 'Alice' });
    }
    expect(captures.length).toBeGreaterThanOrEqual(1);
  });

  it('handles GraphQL query-level aliases of the same schema field with different args', async () => {
    // One schema field (`postsByPublished(published: Int!)`) selected
    // twice via GraphQL aliases with different arg values. The mapper
    // keys `rowFields` by alias, runs the query callback per alias with
    // that alias's resolved args, and returns the right rows under each
    // alias key.
    const { result } = await runQuery(`{
      users {
        id
        drafts: postsByPublished(published: 0) { id }
        publishedPosts: postsByPublished(published: 1) { id }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        id: string;
        drafts: Array<{ id: string }>;
        publishedPosts: Array<{ id: string }>;
      }>;
    };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.drafts.map((p) => p.id)).toEqual(['p-draft1']);
    expect(alice?.publishedPosts.map((p) => p.id)).toEqual(['p-hello']);
    const bob = data.users.find((u) => u.id === 'u-bob');
    expect(bob?.drafts.map((p) => p.id)).toEqual(['p-bob-draft']);
    expect(bob?.publishedPosts.map((p) => p.id)).toEqual(['p-bob1']);
  });

  it('mixes schema-level sibling fields with query-level aliases in one query', async () => {
    // Three different schema fields backing `posts` (the unrefined
    // `posts`, plus the filtered `drafts` and `publishedPosts`) PLUS
    // two GraphQL aliases of `postsByPublished` with different args —
    // all in one selection set. The mapper collects them all under
    // the single `posts` relation group and emits one combine with
    // five branches keyed by alias. Data correctness verifies each
    // branch lands on its own parent key.
    const { result } = await runQuery(`{
      users {
        id
        posts { id }
        drafts { id }
        publishedPosts { id }
        zero: postsByPublished(published: 0) { id }
        one: postsByPublished(published: 1) { id }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        id: string;
        posts: Array<{ id: string }>;
        drafts: Array<{ id: string }>;
        publishedPosts: Array<{ id: string }>;
        zero: Array<{ id: string }>;
        one: Array<{ id: string }>;
      }>;
    };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.posts.map((p) => p.id).sort()).toEqual(['p-draft1', 'p-hello']);
    expect(alice?.drafts.map((p) => p.id)).toEqual(['p-draft1']);
    expect(alice?.publishedPosts.map((p) => p.id)).toEqual(['p-hello']);
    expect(alice?.zero.map((p) => p.id)).toEqual(['p-draft1']);
    expect(alice?.one.map((p) => p.id)).toEqual(['p-hello']);
  });

  it('groups sibling-aliased relations into one combine include', async () => {
    const { result, captures } = await runQuery(
      '{ users { id drafts { id } publishedPosts { id } } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{
        id: string;
        drafts: Array<{ id: string }>;
        publishedPosts: Array<{ id: string }>;
      }>;
    };
    const alice = data.users.find((u) => u.id === 'u-alice');
    expect(alice?.drafts.map((p) => p.id)).toEqual(['p-draft1']);
    expect(alice?.publishedPosts.map((p) => p.id)).toEqual(['p-hello']);
    // The mapper emits a single combine() branch for the two aliases
    // and the data lifts onto separate parent keys correctly. The
    // captured SQL count is currently >1 because prisma-next's orm-
    // client short-circuits combine into multi-query (Issue B in the
    // handoff). When the upstream fix lands this tightens to
    // `toHaveLength(1)`.
    expect(captures.length).toBeGreaterThanOrEqual(1);
  });
});
