import { subscribe as toolsSubscribe } from '@graphql-tools/executor';
import SchemaBuilder from '@pothos/core';
import { type DocumentNode, execute, type GraphQLSchema, parse, subscribe } from 'graphql';
import { describe, expect, it, vi } from 'vitest';
import PrismaNextPlugin, { collectionFromInfo } from '../src';
import { PrismaNextAdapter } from '../src/utils/adapter';
import { detailOf, unexpected } from './fixtures/errors';
import {
  createBuilder,
  deferSchema,
  run,
  runIncremental,
  type SampleOptions,
  sampleContract,
  useCollisionDb,
  useSampleDb,
} from './fixtures/helpers';

const db = useSampleDb();
const collision = useCollisionDb();
const allPostIds = ['p-hello', 'p-draft1', 'p-bob1', 'p-bob-draft'];

function schema(options: SampleOptions & { defer?: boolean } = {}) {
  const { defer, ...pluginOptions } = options;
  const builder = createBuilder(pluginOptions);
  builder.prismaObject('User', {
    select: ['lastName'],
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('firstName'),
      fullName: t.string({ resolve: (user) => user.lastName }),
      label: t.string({ select: ['email'], resolve: (user) => user.email }),
      asyncLabel: t.string({
        select: async () => ({ email: true }),
        resolve: (user) => user.email,
      }),
      constant: t.string({ resolve: () => 'constant' }),
      posts: t.relation('posts'),
    }),
  });
  const Post = builder.prismaObject('Post', {
    fields: (t) => ({
      title: t.exposeString('title'),
      label: t.string({ resolve: () => 'Post' }),
      author: t.relation('author'),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaField({
        type: ['Post'],
        collection: () => db.orm.Post.orderBy((p) => p.id.asc()),
      }),
      users: t.prismaField({
        type: ['User'],
        collection: () => db.orm.User.orderBy((u) => u.id.asc()),
      }),
      wrapped: t.prismaField({
        type: ['Post'],
        errors: { types: [] },
        collection: () => db.orm.Post.where({ authorId: 'u-alice' }),
      }),
      plain: t.field({
        type: [Post],
        resolve: () => [
          // @ts-expect-error a row built by hand isn't planned; it reloads
          { authorId: 'u-alice', id: 'p-hello' },
          // @ts-expect-error a row built by hand isn't planned; it reloads
          { authorId: 'u-alice', id: 'p-draft1' },
        ],
      }),
    }),
  });
  return defer ? deferSchema(builder) : builder.toSchema();
}

describe('reloading through collections', () => {
  it('keeps one query for compatible selections and dependency-free fields', async () => {
    const result = await run(schema(), '{ users { constant fullName label name } }');
    expect(result.errors).toBeUndefined();
    expect(result.statements).toHaveLength(1);
  });

  it('does not reload fields with no declared dependencies beneath a wrapper', async () => {
    const result = await run(
      schema(),
      '{ wrapped { ... on QueryWrappedSuccess { data { label } } } }',
    );
    expect(result.data).toEqual({ wrapped: { data: [{ label: 'Post' }, { label: 'Post' }] } });
    expect(result.statements).toHaveLength(1);
  });

  it('identifies rows by a compound key and maps them back to every parent', async () => {
    const contract = structuredClone(sampleContract);
    const post = contract.storage.namespaces.__unbound__.entries.table.post;
    (post.primaryKey as unknown as { columns: string[] }).columns = ['authorId', 'id'];
    const result = await run(
      schema({ client: () => db.client, context: { ...db.client.context, contract } }),
      '{ plain { title } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.plain).toEqual([{ title: 'Hello, Pothos' }, { title: 'Draft #1' }]);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).toMatch(/"authorId".*=.*\bAND\b.*"id".*\bOR\b/);
  });

  it('keeps rows that share part of a compound key apart', async () => {
    const contract = structuredClone(sampleContract);
    const post = contract.storage.namespaces.__unbound__.entries.table.post;
    (post.primaryKey as unknown as { columns: string[] }).columns = ['authorId', 'id'];
    const builder = createBuilder({
      client: () => db.client,
      context: { ...db.client.context, contract },
    });
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.field({
          type: [Post],
          resolve: () => [
            // @ts-expect-error a row built by hand isn't planned; it reloads
            { authorId: 'u-alice', id: 'p-hello' },
            // @ts-expect-error a row built by hand isn't planned; it reloads
            { authorId: 'u-alice', id: 'p-draft1' },
          ],
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ posts { title } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([{ title: 'Hello, Pothos' }, { title: 'Draft #1' }]);
    expect(result.statements).toHaveLength(1);
  });

  it('loads missing selections of rows a plain field returns, batched across parents', async () => {
    const result = await run(schema(), '{ plain { title author { name } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.plain).toEqual([
      { title: 'Hello, Pothos', author: { name: 'Alice' } },
      { title: 'Draft #1', author: { name: 'Alice' } },
    ]);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].params).toEqual(expect.arrayContaining(['p-hello', 'p-draft1']));
  });

  it("keeps the keys a resolver added that aren't the model's when a field reloads", async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        postCount: t.string({
          select: { posts: true },
          resolve: (user) =>
            `${(user as { nickname?: string }).nickname}: ${user.posts.length} posts`,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.field({ type: User, resolve: () => ({ id: 'u-alice', nickname: 'Al' }) as never }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { postCount } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({ postCount: 'Al: 2 posts' });
    expect(result.statements).toHaveLength(1);
  });

  it('checks whether a reload joins a batch once per selection, not once per row', async () => {
    const builder = createBuilder();
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.field({
          type: [Post],
          // @ts-expect-error a row built by hand isn't planned; it reloads
          resolve: () => Array.from({ length: 200 }, (_, i) => ({ id: allPostIds[i % 4] })),
        }),
      }),
    });
    const schema = builder.toSchema();
    const merges = vi.spyOn(PrismaNextAdapter.prototype, 'canMergeNode');
    try {
      const result = await run(schema, '{ posts { title } }');
      expect(result.errors).toBeUndefined();
      expect(result.data.posts).toHaveLength(200);
      expect(result.statements).toHaveLength(1);
      // Every row reloads through the same selection, which joins the batch it was merged into.
      expect(merges.mock.calls.length).toBeLessThan(4);
    } finally {
      merges.mockRestore();
    }
  });

  it('loads through a client computed from the request context', async () => {
    const contexts: unknown[] = [];
    const builder = createBuilder<{ tenant: string }>({
      // Without `context`, like a transaction. Codecs come from the `context` passed beside it.
      client: (ctx) => {
        contexts.push(ctx);
        return { orm: { Post: db.orm.Post.where({ authorId: ctx.tenant }) } };
      },
    });
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.field({
          type: [Post],
          // @ts-expect-error a row built by hand isn't planned; it reloads
          resolve: () => [{ id: 'p-hello' }, { id: 'p-draft1' }],
        }),
      }),
    });
    const schema = builder.toSchema();
    const result = await run(schema, '{ posts { title } }', {
      context: { tenant: 'u-alice' },
    });
    expect(result.data.posts).toEqual([{ title: 'Hello, Pothos' }, { title: 'Draft #1' }]);
    expect(contexts).toEqual([{ tenant: 'u-alice' }]);
    const other = await run(schema, '{ posts { title } }', { context: { tenant: 'u-bob' } });
    expect(other.errors?.map((error) => error.path)).toEqual([
      ['posts', 0, 'title'],
      ['posts', 1, 'title'],
    ]);
    expect(detailOf(other.errors?.[0])).toMatch(/could not find the 'Post' row/);
    expect(contexts).toEqual([{ tenant: 'u-alice' }, { tenant: 'u-bob' }]);
  });
});

describe('client failures', () => {
  const clientWith = (orm: object) => () => ({ orm });

  it('fails each parent whose row the client excludes', async () => {
    const result = await run(
      schema({ client: clientWith({ Post: db.orm.Post.where({ authorId: 'u-bob' }) }) }),
      '{ plain { title } }',
    );
    expect(result.errors?.map((error) => error.path)).toEqual([
      ['plain', 0, 'title'],
      ['plain', 1, 'title'],
    ]);
    expect(
      result.errors?.every((error) => /could not find the 'Post' row/.test(detailOf(error))),
    ).toBe(true);
  });

  it('reports a missing collection for every parent without hanging the batch', async () => {
    const result = await run(
      schema({ client: clientWith({ User: db.orm.User }) }),
      '{ plain { title } }',
    );
    expect(result.errors).toHaveLength(2);
    expect(
      result.errors?.every((error) => /has no collection for 'Post'/.test(detailOf(error))),
    ).toBe(true);
  });
});

describe('provenance', () => {
  it('does not let a reloaded row claim coverage for a sibling resolved later', async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({ name: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.field({
          type: [User],
          resolve: () => [
            // @ts-expect-error a row built by hand isn't planned; it reloads
            { id: 'u-alice' },
            // @ts-expect-error a row built by hand isn't planned; it reloads
            new Promise<{ id: string }>((resolve) =>
              setTimeout(() => resolve({ id: 'u-bob' }), 20),
            ),
          ],
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { name } }');
    expect(result.data).toEqual({ users: [{ name: 'Alice' }, { name: 'Bob' }] });
    expect(result.statements).toHaveLength(2);
  });

  it('keeps different field definitions apart, and batches repeated paths and parents', async () => {
    const builder = createBuilder();
    const One = builder.prismaObject('User', {
      variant: 'One',
      fields: (t) => ({ count: t.relationCount('posts', { query: { where: { published: 1 } } }) }),
    });
    const Zero = builder.prismaObject('User', {
      variant: 'Zero',
      fields: (t) => ({
        count: t.relationCount('posts', { query: { where: { published: 9 } } }),
        posts: t.relation('posts', { query: { where: { published: 9 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    const parents = () => [{ id: 'u-alice' }, { id: 'u-bob' }];
    builder.queryType({
      fields: (t) => ({
        // @ts-expect-error a row built by hand isn't planned; it reloads
        one: t.field({ type: [One], resolve: parents }),
        // @ts-expect-error a row built by hand isn't planned; it reloads
        zero: t.field({ type: [Zero], resolve: parents }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ one { count } again: one { count } zero { count posts { title } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      one: [{ count: 1 }, { count: 1 }],
      again: [{ count: 1 }, { count: 1 }],
      zero: [
        { count: 0, posts: [] },
        { count: 0, posts: [] },
      ],
    });
    // Each definition reads its own slot, so one batch loads them all.
    expect(result.statements).toHaveLength(1);
    for (const { params } of result.statements) {
      expect(params).toEqual(expect.arrayContaining(['u-alice', 'u-bob']));
    }
  });

  it('keeps nested field definitions apart while merging the same outer relation', async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        published: t.relationCount('posts', { query: { where: { published: 1 } } }),
        missing: t.relationCount('posts', { query: { where: { published: 9 } } }),
      }),
    });
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({ author: t.relation('author', { type: User }) }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.field({
          type: [Post],
          // @ts-expect-error a row built by hand isn't planned; it reloads
          resolve: () => [{ id: 'p-hello' }, { id: 'p-draft1' }],
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ one: posts { author { count: published } } zero: posts { author { count: missing } } }',
    );
    expect(result.data).toEqual({
      one: [{ author: { count: 1 } }, { author: { count: 1 } }],
      zero: [{ author: { count: 0 } }, { author: { count: 0 } }],
    });
    // Each definition is a consumer of its own, so one batch reloads both.
    expect(result.statements).toHaveLength(1);
  });

  it('batches function selections with different args per connection path', async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        count: t.relationCount('posts', {
          args: { published: t.arg.int({ required: true }) },
          query: (args) => ({ where: (post) => post.published.eq(args.published) }),
        }),
        page: t.relatedConnection('posts', {
          totalCount: true,
          args: { published: t.arg.int({ required: true }) },
          query: (args) => ({ where: (post) => post.published.eq(args.published) }),
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({ type: 'User', collection: () => db.orm.User }),
        // @ts-expect-error a row built by hand isn't planned; it reloads
        user: t.field({ type: User, resolve: () => ({ id: 'u-alice' }) }),
      }),
    });
    const s = builder.toSchema();
    const connection = await run(
      s,
      '{ users(first: 2) { edges { node { count(published: 1) } } nodes { count(published: 9) } } }',
    );
    expect(connection.data).toEqual({
      users: {
        edges: [{ node: { count: 1 } }, { node: { count: 1 } }],
        nodes: [{ count: 0 }, { count: 0 }],
      },
    });
    // The counts load apart by their arguments, both beside the users.
    expect(connection.statements).toHaveLength(1);

    const counts = await run(
      s,
      '{ one: user { page(published: 1) { totalCount } } zero: user { page(published: 9) { totalCount } } }',
    );
    expect(counts.errors).toBeUndefined();
    expect(counts.data).toEqual({
      one: { page: { totalCount: 1 } },
      zero: { page: { totalCount: 0 } },
    });
  });
});

describe('deferred fragments', () => {
  it('skips deferred selections with a provider and loads them in one batch', async () => {
    const result = await runIncremental(
      schema({ defer: true }),
      '{ users { id ... @defer { name fullName label asyncLabel posts { title } } } }',
    );
    expect(result.initial.errors).toBeUndefined();
    expect(result.initialStatements).toBe(1);
    expect(result.statements[0].sql).not.toMatch(/firstName|email|title/);
    expect(result.patches).toEqual([
      {
        name: 'Alice',
        fullName: 'Andrews',
        label: 'alice@example.com',
        asyncLabel: 'alice@example.com',
        posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }],
      },
      {
        name: 'Bob',
        fullName: 'Brown',
        label: 'bob@example.com',
        asyncLabel: 'bob@example.com',
        posts: [{ title: 'Bob writes' }, { title: 'Bob draft' }],
      },
    ]);
    expect(result.statements).toHaveLength(2);
  });

  it('keeps path-local aliases apart when deferred selections are loaded', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        published: t.relationCount('posts', { query: { where: { published: 1 } } }),
        missing: t.relationCount('posts', { query: { where: { published: 9 } } }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await runIncremental(
      deferSchema(builder),
      '{ one: user { ... @defer { count: published } } zero: user { ... @defer { count: missing } } }',
    );
    expect(result.patches).toEqual([{ count: 1 }, { count: 0 }]);
  });
});

describe('models without a key', () => {
  function keylessSchema(defer = false) {
    const builder = createBuilder();
    builder.prismaObject('Post', {
      fields: (t) => ({
        title: t.exposeString('title'),
        viewCount: t.relationCount('views'),
        views: t.relation('views', { query: { orderBy: { viewer: 'asc' } } }),
      }),
    });
    const View = builder.prismaObject('PostView', {
      fields: (t) => ({
        viewer: t.exposeString('viewer'),
        viewedAt: t.string({
          nullable: true,
          select: ['viewedAt'],
          resolve: (view) => String(view.viewedAt),
        }),
        // Nullable, so a failed reload nulls only the field.
        post: t.relation('post', { nullable: true }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
        views: t.prismaField({
          type: ['PostView'],
          collection: () => db.orm.PostView.orderBy((view) => view.viewer.asc()),
        }),
        plainViews: t.field({
          type: [View],
          resolve: () => [{ viewer: 'Dave' }] as never,
        }),
        builtViews: t.field({
          type: [View],
          resolve: () => [{ postId: 'p-hello', viewer: 'Dave', viewedAt: 'then' }] as never,
        }),
      }),
    });
    return defer ? deferSchema(builder) : builder.toSchema();
  }

  const keylessError = (field: string) =>
    expect.objectContaining({
      message: 'Unexpected error.',
      originalError: unexpected(
        new RegExp(
          `^Field 'PostView\\.${field}' needs its parent reloaded, but model 'PostView' has no non-null primary or unique key`,
        ),
      ),
    });

  it('loads relations and counts planned in the parent query', async () => {
    const result = await run(
      keylessSchema(),
      '{ posts { title viewCount views { viewer post { title } } } views { viewer viewedAt post { title } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      {
        title: 'Hello, Pothos',
        viewCount: 2,
        views: ['Bob', 'Carol'].map((viewer) => ({ viewer, post: { title: 'Hello, Pothos' } })),
      },
    ]);
    expect(result.data.views).toEqual([
      { viewer: 'Alice', viewedAt: expect.any(String), post: { title: 'Bob writes' } },
      { viewer: 'Bob', viewedAt: expect.any(String), post: { title: 'Hello, Pothos' } },
      { viewer: 'Carol', viewedAt: expect.any(String), post: { title: 'Hello, Pothos' } },
    ]);
    expect(result.statements).toHaveLength(2);
  });

  it('fails deferred fields without loading them', async () => {
    const result = await runIncremental(
      keylessSchema(true),
      '{ views { viewer ... @defer { viewedAt post { title } } } }',
    );
    expect(result.initial.errors).toBeUndefined();
    expect(result.patchErrors).toHaveLength(6);
    expect(result.patchErrors).toEqual(
      expect.arrayContaining([keylessError('viewedAt'), keylessError('post')]),
    );
    expect(result.patches).toEqual([0, 1, 2].map(() => ({ viewedAt: null, post: null })));
    expect(result.statements).toHaveLength(1);
  });

  it('fails fields on rows not loaded by a prisma field while siblings resolve', async () => {
    const result = await run(
      keylessSchema(),
      '{ plainViews { viewer viewedAt } builtViews { viewer viewedAt post { title } } }',
    );
    expect(result.errors).toHaveLength(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([keylessError('viewedAt'), keylessError('post')]),
    );
    expect(result.data).toEqual({
      plainViews: [{ viewer: 'Dave', viewedAt: null }],
      builtViews: [{ viewer: 'Dave', viewedAt: 'then', post: null }],
    });
    expect(result.statements).toHaveLength(0);
  });
});

describe('reload isolation', () => {
  function isolationSchema(calls = { ok: 0, guarded: 0, refined: 0 }) {
    const builder = createBuilder<{ allow?: boolean }>();
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        name: t.exposeString('firstName'),
        posts: t.relation('posts', {
          args: { published: t.arg.int() },
          query: (args: { published?: number | null }) => ({
            where: args.published == null ? undefined : { published: args.published },
          }),
        }),
        // No arguments: @graphql-tools/executor coerces them with a graphql vitest doesn't inline.
        publishedPosts: t.relation('posts', { query: { where: { published: 1 } } }),
        ok: t.relationCount('posts', {
          query: () => ({
            where: (post) => {
              calls.ok += 1;
              return post.published.eq(1);
            },
          }),
        }),
        guarded: t.relationCount('posts', {
          query: (_args, ctx) => ({
            where: (post) => {
              calls.guarded += 1;
              if (!ctx.allow) {
                throw new Error('not allowed');
              }
              return post.published.eq(1);
            },
          }),
        }),
        guardedPosts: t.relation('posts', {
          nullable: true,
          query: (_args, ctx) => ({
            where: (post) => {
              calls.refined += 1;
              if (!ctx.allow) {
                throw new Error('posts not allowed');
              }
              return post.published.eq(1);
            },
          }),
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        plainUsers: t.field({
          type: [User],
          // A count is never null, so a failed one nulls its user.
          nullable: { list: false, items: true },
          // @ts-expect-error a row built by hand isn't planned; it reloads
          resolve: () => [{ id: 'u-alice' }, { id: 'u-bob' }],
        }),
        users: t.prismaField({
          type: [User],
          nullable: true,
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        // Rows loaded elsewhere, holding every post.
        rawUsers: t.field({
          type: [User],
          resolve: () =>
            // @ts-expect-error a row an ORM query loaded isn't planned; it reloads
            db.orm.User.include('posts')
              .orderBy((user) => user.id.asc())
              .all(),
        }),
      }),
    });
    builder.subscriptionType({
      fields: (t) => ({
        userChanged: t.field({
          type: User,
          // The first event is planned, the second hands on a row loaded elsewhere.
          subscribe: async function* () {
            yield null;
            yield await db.orm.User.include('posts').where({ id: 'u-alice' }).first();
          },
          resolve: async (row, _args, context, info) =>
            // @ts-expect-error a row an ORM query loaded isn't planned; it reloads
            row ??
            (await (
              await collectionFromInfo({
                collection: db.orm.User.where({ id: 'u-alice' }),
                context,
                info,
              })
            ).first())!,
        }),
        snapshotThenRaw: t.field({
          type: User,
          // A snapshot loaded with the planned query, then a row loaded elsewhere.
          subscribe: async function* (_root, _args, context, info) {
            yield (await (
              await collectionFromInfo({
                collection: db.orm.User.where({ id: 'u-alice' }),
                context,
                info,
              })
            ).first())!;
            yield (await db.orm.User.include('posts').where({ id: 'u-alice' }).first())!;
          },
          // @ts-expect-error a row an ORM query loaded isn't planned; it reloads
          resolve: (row) => row,
        }),
      }),
    });
    return builder.toSchema();
  }

  /** Sheets resolved by hand, so each field loads through its own reload plan. */
  function sheetSchema(sheets: { id: unknown }[], calls = { rows: 0 }) {
    const builder = new SchemaBuilder<{
      Context: { allow?: boolean };
      PrismaNextContract: typeof collision.contract;
    }>({
      plugins: [PrismaNextPlugin],
      prismaNext: { client: collision.client },
    });
    const Sheet = builder.prismaObject('Sheet', {
      fields: (t) => ({
        name: t.exposeString('name', { nullable: true }),
        rowCount: t.relationCount('rows', {
          query: () => ({
            where: (row) => {
              calls.rows += 1;
              return row.label.eq('r10');
            },
          }),
        }),
        noteCount: t.relationCount('notes', {
          query: (_args, ctx) => ({
            where: (note) => {
              if (!ctx.allow) {
                throw new Error('notes not allowed');
              }
              return note.id.eq(20);
            },
          }),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        sheets: t.field({
          type: [Sheet],
          // A count is never null, so a failed one nulls its sheet.
          nullable: { list: false, items: true },
          resolve: () => sheets as never,
        }),
      }),
    });
    return builder.toSchema();
  }

  /** The errors as path and message, in path order. */
  const errorsOf = (result: {
    errors?: readonly { path?: readonly unknown[]; message: string }[];
  }) =>
    result.errors
      ?.map((error) => [error.path?.join('.') ?? '', error.message] as const)
      .sort(([a], [b]) => a.localeCompare(b));

  it('plans each execution sharing a context with its own variables', async () => {
    const schema = isolationSchema();
    const contextValue = {};
    const document = parse('query ($p: Int) { plainUsers { posts(published: $p) { id } } }');
    const published = await execute({ schema, document, contextValue, variableValues: { p: 1 } });
    const drafts = await execute({ schema, document, contextValue, variableValues: { p: 0 } });
    expect(published).toEqual({
      data: { plainUsers: [{ posts: [{ id: 'p-hello' }] }, { posts: [{ id: 'p-bob1' }] }] },
    });
    expect(drafts).toEqual({
      data: { plainUsers: [{ posts: [{ id: 'p-draft1' }] }, { posts: [{ id: 'p-bob-draft' }] }] },
    });
  });

  it('keeps the relation filter on rows a later operation sharing the context loaded elsewhere', async () => {
    const schema = isolationSchema();
    const contextValue = {};
    const published = {
      data: { users: [{ posts: [{ id: 'p-hello' }] }, { posts: [{ id: 'p-bob1' }] }] },
    };
    expect(
      await execute({
        schema,
        document: parse('{ users { posts(published: 1) { id } } }'),
        contextValue,
      }),
    ).toEqual(published);
    expect(
      await execute({
        schema,
        document: parse('{ users: rawUsers { posts(published: 1) { id } } }'),
        contextValue,
      }),
    ).toEqual(published);
  });

  // graphql-js gives each event its own `variableValues` (16) or `getAbortSignal` (17), while
  // @graphql-tools/executor (Yoga) hands every event and the `subscribe` the same ones.
  describe.each([
    ['graphql-js', subscribe as Subscribe],
    ['@graphql-tools/executor', toolsSubscribe as Subscribe],
  ])('subscription events through %s', (_, subscribeWith) => {
    const published = (field: string) => ({
      data: { [field]: { publishedPosts: [{ id: 'p-hello' }] } },
    });

    it('keeps the relation filter on a row a later event loaded elsewhere', async () => {
      expect(
        await events(subscribeWith, 'subscription { userChanged { publishedPosts { id } } }'),
      ).toEqual([published('userChanged'), published('userChanged')]);
    });

    it('keeps the relation filter on a raw event yielded after a planned snapshot', async () => {
      expect(
        await events(subscribeWith, 'subscription { snapshotThenRaw { publishedPosts { id } } }'),
      ).toEqual([published('snapshotThenRaw'), published('snapshotThenRaw')]);
    });
  });

  type Subscribe = (args: {
    schema: GraphQLSchema;
    document: DocumentNode;
    contextValue: object;
  }) => unknown;

  /** Every event of `source`, subscribed to with `subscribeWith` on a fresh context. */
  async function events(subscribeWith: Subscribe, source: string) {
    const result = (await subscribeWith({
      schema: isolationSchema(),
      document: parse(source),
      contextValue: {},
    })) as AsyncIterable<unknown> | object;
    if (!(Symbol.asyncIterator in result)) {
      throw new Error(`Expected a subscription, got ${JSON.stringify(result)}`);
    }
    const seen: unknown[] = [];
    for await (const event of result) {
      seen.push(event);
    }
    return seen;
  }

  it('fails every field of a batch whose callback throws, like a parent query', async () => {
    const result = await run(
      isolationSchema(),
      '{ plainUsers { name ok guarded guardedPosts { id } } }',
    );
    // The failed counts null each user, so which of its fields report first varies.
    const errors = errorsOf(result) ?? [];
    expect(new Set(errors.map(([path]) => path.split('.').slice(0, 2).join('.')))).toEqual(
      new Set(['plainUsers.0', 'plainUsers.1']),
    );
    expect(new Set(errors.map(([, message]) => message))).toEqual(new Set(['posts not allowed']));
    expect(result.data.plainUsers).toEqual([null, null]);
    expect(result.statements).toHaveLength(0);
  });

  it('fails the parent query a callback throws in, like a reload batch', async () => {
    const result = await run(isolationSchema(), '{ users { name guardedPosts { id } } }');
    expect(errorsOf(result)).toEqual([['users', 'posts not allowed']]);
    expect(result.data.users).toBeNull();
    expect(result.statements).toHaveLength(0);
  });

  it('loads every merged plan in one statement when no callback throws', async () => {
    const calls = { ok: 0, guarded: 0, refined: 0 };
    const result = await run(
      isolationSchema(calls),
      '{ plainUsers { name ok guarded guardedPosts { id } } }',
      { context: { allow: true } },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.plainUsers).toEqual([
      { name: 'Alice', ok: 1, guarded: 1, guardedPosts: [{ id: 'p-hello' }] },
      { name: 'Bob', ok: 1, guarded: 1, guardedPosts: [{ id: 'p-bob1' }] },
    ]);
    expect(calls).toEqual({ ok: 1, guarded: 1, refined: 1 });
    expect(result.statements).toHaveLength(1);
  });

  it('issues no statement when the codecs reject every parent', async () => {
    const result = await run(sheetSchema([{ id: '1' }]), '{ sheets { name rowCount } }');
    // The failed count nulls the sheet.
    expect(result.data.sheets).toEqual([null]);
    expect(result.errors?.map((error) => error.path?.join('.'))).toContain('sheets.0.rowCount');
    expect(result.statements).toHaveLength(0);
  });
});
