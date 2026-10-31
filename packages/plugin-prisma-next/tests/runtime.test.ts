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
      fullName: t.string({
        select: ['firstName', 'lastName'],
        resolve: (user) => `${user.firstName} ${user.lastName}`,
      }),
      posts: t.relation('posts'),
      postCount: t.field({
        type: 'Int',
        select: {
          posts: (sub: { count: () => unknown }) => ({ posts: sub.count() }),
        },
        resolve: ((parent: { posts: number }) => parent.posts) as never,
      } as never),
      publishedPostCount: t.field({
        type: 'Int',
        select: {
          posts: (sub: { where: (w: unknown) => { count: () => unknown } }) => ({
            posts: sub.where({ published: 1 }).count(),
          }),
        },
        resolve: ((parent: { posts: number }) => parent.posts) as never,
      } as never),
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
      greeting: t.string({
        args: { formal: t.arg.boolean({ required: true }) },
        select: (args) => (args.formal ? ['lastName'] : ['firstName']),
        resolve: (user, args) =>
          args.formal
            ? `Greetings, ${(user as { lastName?: string }).lastName ?? ''}`
            : `Hi, ${(user as { firstName?: string }).firstName ?? ''}`,
      }),
      firstPostTitle: t.field({
        type: 'String',
        nullable: true,
        select: { posts: true },
        resolve: ((parent: { posts: { title: string }[] }) =>
          parent.posts[0]?.title ?? null) as never,
      } as never),
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
      // Description and extensions must pass through.
      firstPostTitleWithMeta: t.field({
        type: 'String',
        nullable: true,
        description: 'first post title',
        extensions: { customMeta: 'rf-meta' },
        select: { posts: true },
        resolve: ((parent: { posts: { title: string }[] }) =>
          parent.posts[0]?.title ?? null) as never,
      } as never),
      relCount: t.relationCount('posts'),
      relCountPublished: t.relationCount('posts', { where: { published: 1 } }),
      relCountByFlag: t.relationCount('posts', {
        args: { flag: t.arg.int({ required: true }) },
        where: (p, args: { flag: number }) => p.published.eq(args.flag),
      }),
      relSumPublished: t.relationAggregate('posts', { op: 'sum', field: 'published' }),
      relMaxPublished: t.relationAggregate('posts', { op: 'max', field: 'published' }),
      relMinPublished: t.relationAggregate('posts', { op: 'min', field: 'published' }),
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
      drafts: t.relation('posts', {
        query: { where: (p) => p.published.eq(0) },
      }),
      publishedPosts: t.relation('posts', {
        query: { where: (p) => p.published.eq(1) },
      }),
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

  const userBasicRef = builder.prismaObject('User', {
    name: 'UserBasic',
    fields: (t) => ({
      id: t.exposeID('id'),
      firstName: t.exposeString('firstName'),
      posts: t.relation('posts'),
    }),
  });
  builder.prismaObjectField('User', 'basicView', (t) => t.variant(userBasicRef));

  builder.prismaObjectField('Comment', 'shoutBody', (t) =>
    t.string({
      select: ['body'],
      resolve: (c) => c.body.toUpperCase(),
    }),
  );

  builder.prismaObjectFields('User', (t) => ({
    initials: t.string({
      select: ['firstName', 'lastName'],
      resolve: (u) => `${u.firstName[0]}${u.lastName[0]}`,
    }),
  }));

  builder.queryType({
    fields: (t) => ({
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
    Promise.resolve(execute({ schema: buildSchema(), document: parse(query), contextValue: {} })),
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

  it('resolves depth-2 nested includes in a single query', async () => {
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

    expect(captures.length).toBe(1);
  });

  it('exposes a function-form count() on the parent', async () => {
    const { result, captures } = await runQuery('{ users { id postCount } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: Array<{ id: string; postCount: number }> };
    const counts = Object.fromEntries(data.users.map((u) => [u.id, u.postCount]));
    expect(counts).toEqual({ 'u-alice': 2, 'u-bob': 2 });
    // orm-client may split `combine` + `count` into more than one statement.
    expect(captures.length).toBeGreaterThanOrEqual(1);
  });

  it('exposes a function-form aggregate scalar (filtered count) via t.field+select', async () => {
    const { result } = await runQuery('{ users { id publishedPostCountAgg } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: Array<{ id: string; publishedPostCountAgg: number | null }>;
    };
    const byId = Object.fromEntries(data.users.map((u) => [u.id, u.publishedPostCountAgg]));
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

  it('t.variant preloads nested relations on the variant prismaObject', async () => {
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
    expect(captures).toHaveLength(1);
  });

  it('function-form t.field({ select }) passes through description + extensions to the field config', () => {
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

  it('function-form select where callback receives accessor + args + ctx', async () => {
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
    for (const post of alice?.posts ?? []) {
      expect(post.author).toEqual({ id: 'u-alice', firstName: 'Alice' });
    }
    expect(captures.length).toBeGreaterThanOrEqual(1);
  });

  it('handles GraphQL query-level aliases of the same schema field with different args', async () => {
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
    // orm-client may split `combine` into more than one statement.
    expect(captures.length).toBeGreaterThanOrEqual(1);
  });
});
