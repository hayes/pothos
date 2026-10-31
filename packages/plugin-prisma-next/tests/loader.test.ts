import SchemaBuilder from '@pothos/core';
import { execute, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
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
        select: async () => ['email'],
        resolve: (user) => user.email,
      }),
      constant: t.string({ resolve: () => 'constant' }),
      posts: t.relation('posts'),
      publishedPosts: t.relation('posts', { query: { where: { published: 1 } } }),
    }),
  });
  const Post = builder.prismaObject('Post', {
    fields: (t) => ({
      title: t.exposeString('title'),
      label: t.string({ resolve: () => 'Post' }),
      author: t.relation('author'),
      alice: t.relation('author', { nullable: true, query: { where: { firstName: 'Alice' } } }),
      bob: t.relation('author', { nullable: true, query: { where: { firstName: 'Bob' } } }),
      nobody: t.relation('author', { nullable: true, query: { where: { firstName: 'Nobody' } } }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      posts: t.prismaField({
        type: ['Post'],
        resolve: () => db.orm.Post.orderBy((p) => p.id.asc()),
      }),
      users: t.prismaField({
        type: ['User'],
        resolve: () => db.orm.User.orderBy((u) => u.id.asc()),
      }),
      postPage: t.prismaConnection({
        type: 'Post',
        cursor: ['authorId', 'id'],
        resolve: () => db.orm.Post.where({ authorId: 'u-alice' }),
      }),
      wrapped: t.prismaField({
        type: ['Post'],
        errors: { types: [] },
        resolve: () => db.orm.Post.where({ authorId: 'u-alice' }),
      }),
      plain: t.field({
        type: [Post],
        resolve: () => [{ id: 'p-hello' }, { id: 'p-draft1' }],
      }),
    }),
  });
  return defer ? deferSchema(builder) : builder.toSchema();
}

describe('fallback loading through collections', () => {
  it('keeps one query for compatible selections and dependency-free fields', async () => {
    const result = await run(schema(), '{ users { constant fullName label name } }');
    expect(result.errors).toBeUndefined();
    expect(result.statements).toHaveLength(1);
  });

  it('batches compatible consumers across parents and splits incompatible to-one branches', async () => {
    const result = await run(
      schema(),
      '{ posts { nobody { id } a: alice { name } a2: alice { id } bob { name } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      ...[0, 1].map(() => ({ nobody: null, a: null, a2: null, bob: { name: 'Bob' } })),
      ...[0, 1].map(() => ({
        nobody: null,
        a: { name: 'Alice' },
        a2: { id: 'u-alice' },
        bob: null,
      })),
    ]);
    expect(result.statements).toHaveLength(3);
    for (const { sql, params } of result.statements.slice(1)) {
      expect(sql).toMatch(/\bIN\b/);
      expect(params).toEqual(expect.arrayContaining(allPostIds));
    }
  });

  it('reloads a conflict beneath shared to-one consumers with independent nested selections', async () => {
    const result = await run(
      schema(),
      '{ posts { a: author { posts { nobody { id } alice { name } } } b: author { posts { bob { name } } } } }',
    );
    expect(result.errors).toBeUndefined();
    const [bobDraft, , , hello] = result.data.posts;
    expect(bobDraft.a.posts).toEqual([0, 1].map(() => ({ nobody: null, alice: null })));
    expect(bobDraft.b.posts).toEqual([0, 1].map(() => ({ bob: { name: 'Bob' } })));
    expect(hello.a.posts).toEqual([0, 1].map(() => ({ nobody: null, alice: { name: 'Alice' } })));
    expect(hello.b.posts).toEqual([0, 1].map(() => ({ bob: null })));
    expect(result.statements).toHaveLength(2);
  });

  it.each([
    [
      'a connection',
      '{ postPage(first: 2) { nodes { bob { name } alice { name publishedPosts { title author { name } } } } } }',
      (data: { postPage: { nodes: unknown[] } }) => data.postPage.nodes,
    ],
    [
      'an errors-plugin success wrapper',
      '{ wrapped { ... on QueryWrappedSuccess { data { bob { name } alice { name publishedPosts { title author { name } } } } } } }',
      (data: { wrapped: { data: unknown[] } }) => data.wrapped.data,
    ],
  ])('reloads a conflicting branch beneath %s with its whole subtree in one batch', async (_name, source, rows) => {
    const result = await run(schema(), source);
    expect(result.errors).toBeUndefined();
    expect(rows(result.data)).toEqual(
      [0, 1].map(() => ({
        bob: null,
        alice: {
          name: 'Alice',
          publishedPosts: [{ title: 'Hello, Pothos', author: { name: 'Alice' } }],
        },
      })),
    );
    expect(result.statements).toHaveLength(2);
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
      schema({ client: () => db.client, contract }),
      '{ posts { nobody { id } alice { name } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      ...[0, 1].map(() => ({ nobody: null, alice: null })),
      ...[0, 1].map(() => ({ nobody: null, alice: { name: 'Alice' } })),
    ]);
    expect(result.statements).toHaveLength(2);
    expect(result.statements[1].sql).toMatch(/"authorId".*=.*\bAND\b.*"id".*\bOR\b/);
  });

  it('keeps rows that share part of a compound key apart', async () => {
    const contract = structuredClone(sampleContract);
    const post = contract.storage.namespaces.__unbound__.entries.table.post;
    (post.primaryKey as unknown as { columns: string[] }).columns = ['authorId', 'id'];
    const builder = createBuilder({ client: () => db.client, contract });
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.field({
          type: [Post],
          resolve: () => [
            { authorId: 'u-alice', id: 'p-hello' },
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

  it('loads through a client computed from the request context', async () => {
    const contexts: unknown[] = [];
    const builder = createBuilder<{ tenant: string }>({
      // Without `context`, like a transaction: codecs come from its collections.
      client: (context) => {
        contexts.push(context);
        return { orm: { Post: db.orm.Post.where({ authorId: context.tenant }) } };
      },
    });
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.field({
          type: [Post],
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
    expect(other.errors?.[0].message).toMatch(/could not find model 'Post'/);
    expect(contexts).toEqual([{ tenant: 'u-alice' }, { tenant: 'u-bob' }]);
  });
});

describe('client failures', () => {
  const clientWith = (orm: object) => () => ({ orm });

  it('fails each parent whose row the client excludes', async () => {
    const result = await run(
      schema({ client: clientWith({ Post: db.orm.Post.where({ authorId: 'u-alice' }) }) }),
      '{ posts { nobody { id } alice { name } } }',
    );
    expect(result.errors?.map((error) => error.path)).toEqual([
      ['posts', 0, 'alice'],
      ['posts', 1, 'alice'],
    ]);
    expect(result.errors?.every((error) => /could not find model 'Post'/.test(error.message))).toBe(
      true,
    );
  });

  it('reports a missing collection for every parent without hanging the batch', async () => {
    const result = await run(
      schema({ client: clientWith({ User: db.orm.User }) }),
      '{ posts { nobody { id } alice { name } } }',
    );
    expect(result.errors).toHaveLength(4);
    expect(
      result.errors?.every((error) => /has no collection for 'Post'/.test(error.message)),
    ).toBe(true);
  });

  it('rejects a paginated collection before executing a truncated batch', async () => {
    const result = await run(
      schema({ client: clientWith({ Post: db.orm.Post.limit(1) }) }),
      '{ posts { nobody { id } alice { name } } }',
    );
    expect(result.errors).toHaveLength(4);
    expect(result.errors?.every((error) => /must be unpaginated/.test(error.message))).toBe(true);
    expect(result.statements).toHaveLength(1);
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
            { id: 'u-alice' },
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
      fields: (t) => ({ count: t.relationCount('posts', { where: { published: 1 } }) }),
    });
    const Zero = builder.prismaObject('User', {
      variant: 'Zero',
      fields: (t) => ({
        count: t.relationCount('posts', { where: { published: 9 } }),
        posts: t.relation('posts', { query: { where: { published: 9 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    const parents = () => [{ id: 'u-alice' }, { id: 'u-bob' }];
    builder.queryType({
      fields: (t) => ({
        one: t.field({ type: [One], resolve: parents }),
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
        published: t.relationCount('posts', { where: { published: 1 } }),
        missing: t.relationCount('posts', { where: { published: 9 } }),
      }),
    });
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({ author: t.relation('author', { type: User }) }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.field({
          type: [Post],
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
    expect(result.statements).toHaveLength(2);
  });

  it('batches function selections with different args per connection path', async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        count: t.relationCount('posts', {
          args: { published: t.arg.int({ required: true }) },
          where: (post, args) => post.published.eq(args.published),
        }),
        page: t.relatedConnection('posts', {
          cursor: 'id',
          totalCount: true,
          args: { published: t.arg.int({ required: true }) },
          query: (args) => ({ where: (post) => post.published.eq(args.published) }),
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({ type: 'User', cursor: 'id', resolve: () => db.orm.User }),
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
    expect(connection.statements).toHaveLength(2);
    expect(connection.statements[1].params).toEqual(expect.arrayContaining(['u-alice', 'u-bob']));

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

describe('type prerequisites', () => {
  it('batches a field override that conflicts with its type select across parents', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', {
      select: { title: true, author: { where: { firstName: 'Alice' } } },
      fields: (t) => ({
        prerequisite: t.string({ resolve: (post) => post.author?.firstName ?? 'missing' }),
        label: t.string({
          select: { author: { where: { firstName: 'Bob' } } },
          resolve: (post) => `${post.title}:${post.author?.firstName ?? 'missing'}`,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          resolve: () => db.orm.Post.orderBy((post) => post.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ posts { prerequisite label } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      { prerequisite: 'missing', label: 'Bob draft:Bob' },
      { prerequisite: 'missing', label: 'Bob writes:Bob' },
      { prerequisite: 'Alice', label: 'Draft #1:missing' },
      { prerequisite: 'Alice', label: 'Hello, Pothos:missing' },
    ]);
    expect(result.statements).toHaveLength(2);
    expect(result.statements[1].params).toEqual(expect.arrayContaining(allPostIds));
  });

  it('batches conflicting same-row variant prerequisites independently', async () => {
    const builder = createBuilder();
    const BobPost = builder.prismaObject('Post', {
      variant: 'BobPost',
      select: { author: { where: { firstName: 'Bob' } } },
      fields: (t) => ({
        name: t.string({ resolve: (post) => post.author?.firstName ?? 'missing' }),
      }),
    });
    builder.prismaObject('Post', {
      select: { author: { where: { firstName: 'Alice' } } },
      fields: (t) => ({
        name: t.string({ resolve: (post) => post.author?.firstName ?? 'missing' }),
        view: t.variant(BobPost),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          resolve: () => db.orm.Post.orderBy((post) => post.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ posts { name view { name } } }');
    expect(result.data.posts).toEqual([
      { name: 'missing', view: { name: 'Bob' } },
      { name: 'missing', view: { name: 'Bob' } },
      { name: 'Alice', view: { name: 'missing' } },
      { name: 'Alice', view: { name: 'missing' } },
    ]);
    expect(result.statements).toHaveLength(2);
    expect(result.statements[1].params).toEqual(expect.arrayContaining(allPostIds));
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
        published: t.relationCount('posts', { where: { published: 1 } }),
        missing: t.relationCount('posts', { where: { published: 9 } }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: 'User', resolve: () => db.orm.User.where({ id: 'u-alice' }) }),
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
        views: t.relation('views', { query: { orderBy: (view) => view.viewer.asc() } }),
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
        post: t.relation('post'),
        published: t.relation('post', { nullable: true, query: { where: { published: 1 } } }),
        draft: t.relation('post', { nullable: true, query: { where: { published: 0 } } }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          resolve: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
        views: t.prismaField({
          type: ['PostView'],
          resolve: () => db.orm.PostView.orderBy((view) => view.viewer.asc()),
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

  const keylessError = (field: string, reason: string) =>
    expect.objectContaining({
      message: expect.stringMatching(
        new RegExp(
          `^Field 'PostView\\.${field}' needs its parent reloaded because ${reason}.*model 'PostView' has no non-null primary or unique key.*Add a primary or unique key to 'PostView'`,
        ),
      ),
    });

  it('loads relations and counts planned in the parent query', async () => {
    const result = await run(
      keylessSchema(),
      '{ posts { title viewCount views { viewer post { title } } } views { viewer viewedAt published { title } } }',
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
      { viewer: 'Alice', viewedAt: expect.any(String), published: { title: 'Bob writes' } },
      { viewer: 'Bob', viewedAt: expect.any(String), published: { title: 'Hello, Pothos' } },
      { viewer: 'Carol', viewedAt: expect.any(String), published: { title: 'Hello, Pothos' } },
    ]);
    expect(result.statements).toHaveLength(2);
  });

  it('fails only a to-one field left out of the parent query for a conflicting selection', async () => {
    const result = await run(
      keylessSchema(),
      '{ posts { views { viewer published { title } draft { title } } } }',
    );
    expect(result.errors).toEqual([
      keylessError('draft', 'it was left out of the query that loaded its parent'),
      keylessError('draft', 'it was left out of the query that loaded its parent'),
    ]);
    expect(result.data.posts[0].views).toEqual(
      ['Bob', 'Carol'].map((viewer) => ({
        viewer,
        published: { title: 'Hello, Pothos' },
        draft: null,
      })),
    );
    expect(result.statements).toHaveLength(1);
  });

  it('fails deferred fields without loading them', async () => {
    const result = await runIncremental(
      keylessSchema(true),
      '{ views { viewer ... @defer { viewedAt published { title } } } }',
    );
    expect(result.initial.errors).toBeUndefined();
    expect(result.patchErrors).toEqual(
      [0, 1, 2].flatMap(() => [
        keylessError('viewedAt', "its parent row is missing 'viewedAt'"),
        keylessError('published', 'it was left out of the query that loaded its parent'),
      ]),
    );
    expect(result.patches).toEqual([0, 1, 2].map(() => ({ viewedAt: null, published: null })));
    expect(result.statements).toHaveLength(1);
  });

  it('fails fields on rows not loaded by a prisma field while siblings resolve', async () => {
    const result = await run(
      keylessSchema(),
      '{ plainViews { viewer viewedAt } builtViews { viewer viewedAt published { title } } }',
    );
    expect(result.errors).toEqual([
      keylessError('viewedAt', "its parent row is missing 'viewedAt'"),
      keylessError('published', 'it was left out of the query that loaded its parent'),
    ]);
    expect(result.data).toEqual({
      plainViews: [{ viewer: 'Dave', viewedAt: null }],
      builtViews: [{ viewer: 'Dave', viewedAt: 'then', published: null }],
    });
    expect(result.statements).toHaveLength(0);
  });
});

describe('fallback isolation', () => {
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
        ok: t.relationCount('posts', {
          nullable: true,
          where: (post) => {
            calls.ok += 1;
            return post.published.eq(1);
          },
        }),
        guarded: t.relationCount('posts', {
          nullable: true,
          where: (post, _args, ctx) => {
            calls.guarded += 1;
            if (!ctx.allow) {
              throw new Error('not allowed');
            }
            return post.published.eq(1);
          },
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
          resolve: () => [{ id: 'u-alice' }, { id: 'u-bob' }],
        }),
        users: t.prismaField({
          type: [User],
          nullable: true,
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  /** Sheets resolved by hand, so each field loads through its own fallback plan. */
  function sheetSchema(sheets: { id: unknown }[], calls = { rows: 0 }) {
    const builder = new SchemaBuilder<{
      Context: { allow?: boolean };
      PrismaNextContract: typeof collision.contract;
    }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: collision.client },
    });
    const Sheet = builder.prismaObject('Sheet', {
      fields: (t) => ({
        name: t.exposeString('name', { nullable: true }),
        rowCount: t.relationCount('rows', {
          nullable: true,
          where: (row) => {
            calls.rows += 1;
            return row.label.eq('r10');
          },
        }),
        noteCount: t.relationCount('notes', {
          nullable: true,
          where: (note, _args, ctx) => {
            if (!ctx.allow) {
              throw new Error('notes not allowed');
            }
            return note.id.eq(20);
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        sheets: t.field({ type: [Sheet], resolve: () => sheets as never }),
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

  it('fails every field of a batch whose callback throws, like a parent query', async () => {
    const result = await run(
      isolationSchema(),
      '{ plainUsers { name ok guarded guardedPosts { id } } }',
    );
    expect(errorsOf(result)).toEqual(
      ['0', '1'].flatMap((index) =>
        ['guarded', 'guardedPosts', 'name', 'ok'].map((field) => [
          `plainUsers.${index}.${field}`,
          'posts not allowed',
        ]),
      ),
    );
    expect(result.data.plainUsers).toEqual([
      { name: null, ok: null, guarded: null, guardedPosts: null },
      { name: null, ok: null, guarded: null, guardedPosts: null },
    ]);
    expect(result.statements).toHaveLength(0);
  });

  it('fails the parent query a callback throws in, like a fallback batch', async () => {
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
    expect(result.data.sheets).toEqual([{ name: null, rowCount: null }]);
    expect(result.errors?.map((error) => error.path?.join('.'))).toEqual([
      'sheets.0.name',
      'sheets.0.rowCount',
    ]);
    expect(result.statements).toHaveLength(0);
  });

  it('fails a parent the codecs reject with its own error when a callback fails the batch', async () => {
    const result = await run(
      sheetSchema([{ id: 1 }, { id: '1' }]),
      '{ sheets { name noteCount } }',
    );
    expect(result.data.sheets).toEqual([
      { name: null, noteCount: null },
      { name: null, noteCount: null },
    ]);
    const messages = Object.fromEntries(errorsOf(result) ?? []);
    expect(messages['sheets.0.noteCount']).toBe('notes not allowed');
    expect(messages['sheets.1.noteCount']).not.toBe('notes not allowed');
    expect(result.statements).toHaveLength(0);
  });

  it('fails only the parent whose identity the codecs reject', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { client: collision.client },
    });
    const Sheet = builder.prismaObject('Sheet', {
      fields: (t) => ({ name: t.exposeString('name', { nullable: true }) }),
    });
    builder.queryType({
      fields: (t) => ({
        sheets: t.field({
          type: [Sheet],
          resolve: () => [{ id: 1 }, { id: '1' }] as never,
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ sheets { name } }');
    expect(result.data.sheets).toEqual([{ name: 's1' }, { name: null }]);
    expect(result.errors?.map((error) => error.path)).toEqual([['sheets', 1, 'name']]);
  });
});
