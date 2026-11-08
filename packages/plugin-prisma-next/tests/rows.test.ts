import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import PrismaNextPlugin, { collectionFromInfo } from '../src';
import { createBuilder, run, useCollisionDb, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

describe('rows a resolver returns', () => {
  it.each([
    {},
    { id: 'u-alice' },
  ])('resolves dependency-free fields of %j synchronously without a query', (parent) => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({ constant: t.string({ resolve: () => 'constant' }) }),
    });
    builder.queryType({
      fields: (t) => ({ user: t.field({ type: User, resolve: () => parent as never }) }),
    });
    const result = execute({
      schema: builder.toSchema(),
      document: parse('{ user { constant } }'),
      contextValue: {},
    });
    expect(result).toEqual({ data: { user: { constant: 'constant' } } });
  });

  it.each([
    ['id'] as const,
    { id: true } as const,
  ])('keeps the identity of a row satisfying a scalar type select %j', (select) => {
    const parent = { id: 'u-alice' };
    const labels = new WeakMap([[parent, 'cached label']]);
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      select,
      fields: (t) => ({ label: t.string({ resolve: (user) => labels.get(user) }) }),
    });
    builder.queryType({
      // @ts-expect-error a row built by hand isn't planned; it reloads
      fields: (t) => ({ user: t.field({ type: User, resolve: () => parent }) }),
    });
    const result = execute({
      schema: builder.toSchema(),
      document: parse('{ user { label } }'),
      contextValue: {},
    });
    expect(result).toEqual({ data: { user: { label: 'cached label' } } });
  });

  function staleSchema() {
    const builder = createBuilder();
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        title: t.exposeString('title'),
        content: t.exposeString('content'),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        // @ts-expect-error a row built by hand isn't planned; it reloads
        stale: t.field({ type: Post, resolve: () => ({ id: 'p-hello', title: 'kept' }) }),
        deleted: t.field({
          type: Post,
          // @ts-expect-error a row built by hand isn't planned; it reloads
          resolve: () => ({ id: 'gone', title: 'deleted' }),
        }),
      }),
    });
    return builder.toSchema();
  }

  it('keeps the values a row already owns without a query', async () => {
    const owned = await run(staleSchema(), '{ stale { id title } deleted { id title } }');
    expect(owned.data).toEqual({
      stale: { id: 'p-hello', title: 'kept' },
      deleted: { id: 'gone', title: 'deleted' },
    });
    expect(owned.statements).toHaveLength(0);
  });

  it('loads only the columns a row is missing through the loader', async () => {
    const missing = await run(staleSchema(), '{ stale { title content } }');
    expect(missing.errors).toBeUndefined();
    expect(missing.data.stale).toEqual({ title: 'kept', content: 'Welcome.' });
  });
  it('loads what a planned field reads when its resolver hands back a different row', async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts'),
        postCount: t.relationCount('posts'),
      }),
    });
    builder.prismaObject('Post', {
      fields: (t) => ({
        title: t.exposeString('title'),
        // Planned beneath the author include, but resolved with a row the resolver builds.
        rebuilt: t.field({
          type: User,
          select: (_args, _ctx, nestedSelection) => ({ author: nestedSelection() }),
          // @ts-expect-error a row built by hand isn't planned; it reloads
          resolve: (post) => ({ id: post.author.id }),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        post: t.prismaField({
          type: 'Post',
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ post { rebuilt { postCount posts { title } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.post.rebuilt).toEqual({
      postCount: 2,
      posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }],
    });
  });

  it("reloads a row a resolver returns once for the fields reading the type's select", async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      select: { posts: true },
      fields: (t) => ({
        id: t.exposeID('id'),
        postTotal: t.int({ resolve: (user) => user.posts.length }),
        label: t.string({
          select: { email: true, posts: true },
          resolve: (user) => `${user.email} ${user.posts.length}`,
        }),
        drafts: t.relationCount('posts', { query: { where: { published: 0 } } }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        // @ts-expect-error a row built by hand isn't planned; it reloads
        users: t.field({ type: [User], resolve: () => [{ id: 'u-alice' }, { id: 'u-bob' }] }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { id postTotal label drafts } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: 'u-alice', postTotal: 2, label: 'alice@example.com 2', drafts: 1 },
      { id: 'u-bob', postTotal: 2, label: 'bob@example.com 2', drafts: 1 },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it("loads the type's select for a field selecting only columns", async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      select: { posts: true },
      fields: (t) => ({
        summary: t.string({
          select: ['lastName'],
          resolve: (user) => `${user.lastName} ${user.posts.length}`,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        // @ts-expect-error a row built by hand isn't planned; it reloads
        user: t.field({ type: User, resolve: () => ({ id: 'u-alice', lastName: 'x' }) }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { summary } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({ summary: 'Andrews 2' });
  });

  it('reloads a row another operation planned for its own fields', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        drafts: t.relation('posts', { query: { where: { published: 0 } } }),
        publishedPosts: t.relation('posts', { query: { where: { published: 1 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const cache = new Map<string, object>();
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          resolve: async (users) => {
            const row = cache.get('alice') ?? (await users.where({ id: 'u-alice' }).first())!;
            cache.set('alice', row);
            return row as never;
          },
        }),
      }),
    });
    const schema = builder.toSchema();
    const drafts = await run(schema, '{ user { drafts { id } } }');
    expect(drafts.data.user).toEqual({ drafts: [{ id: 'p-draft1' }] });
    const published = await run(schema, '{ user { publishedPosts { id } } }');
    expect(published.errors).toBeUndefined();
    expect(published.data.user).toEqual({ publishedPosts: [{ id: 'p-hello' }] });
    expect(published.statements).toHaveLength(1);
  });
});

describe('rows the plugin loaded', () => {
  function helperSchema(
    configure: (builder: ReturnType<typeof createBuilder>) => void,
    onRows: (rows: readonly { id: string; posts?: readonly object[] }[]) => void,
  ) {
    const builder = createBuilder();
    configure(builder);
    builder.queryType({
      fields: (t) => ({
        users: t.field({
          type: ['User'] as never,
          resolve: async (_root, _args, context, info) => {
            const users = await collectionFromInfo({ collection: db.orm.User, context, info });
            const rows = await users.orderBy((user) => user.id.asc()).all();
            onRows(rows);
            return rows as never;
          },
        }),
      }),
    });
    return builder.toSchema();
  }

  it('keeps the identity of loaded rows for a scalar-only type select', async () => {
    const labels = new WeakMap<object, string>();
    const schema = helperSchema(
      (builder) =>
        builder.prismaObject('User', {
          select: ['id'],
          fields: (t) => ({ label: t.string({ nullable: true, resolve: (u) => labels.get(u) }) }),
        }),
      (rows) => {
        for (const row of rows) {
          labels.set(row, `cached ${row.id}`);
        }
      },
    );
    const result = await run(schema, '{ users { label } }');
    expect(result.data.users).toEqual([{ label: 'cached u-alice' }, { label: 'cached u-bob' }]);
    expect(result.statements).toHaveLength(1);
  });

  it('keeps the identity of loaded rows and their relations when nothing was combined', async () => {
    const loaded = new WeakSet<object>();
    const schema = helperSchema(
      (builder) => {
        builder.prismaObject('User', {
          select: { posts: true },
          fields: (t) => ({
            same: t.boolean({ resolve: (user) => loaded.has(user) }),
            posts: t.relation('posts'),
          }),
        });
        builder.prismaObject('Post', {
          fields: (t) => ({ same: t.boolean({ resolve: (post) => loaded.has(post) }) }),
        });
      },
      (rows) => {
        for (const row of rows) {
          loaded.add(row);
          for (const post of row.posts ?? []) {
            loaded.add(post);
          }
        }
      },
    );
    const result = await run(schema, '{ users { same posts { same } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { same: true, posts: [{ same: true }, { same: true }] },
      { same: true, posts: [{ same: true }, { same: true }] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('keeps combined relations off the keys of the parent it hands a resolver', async () => {
    const captured: object[] = [];
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Post', {
      fields: (t) => ({
        published: t.relation('comments', { query: { where: { id: 'c-1' } } }),
        seen: t.boolean({
          resolve: (post) => {
            captured.push(post);
            return true;
          },
        }),
      }),
    });
    builder.prismaObject('Comment', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ posts { published { id } seen } }');
    expect(result.errors).toBeUndefined();
    expect(captured).toHaveLength(1);
    // The combined values travel under one symbol, so a copy of the parent keeps them.
    expect(Object.keys(captured[0])).toEqual(['id']);
    expect(Object.getOwnPropertySymbols(captured[0])).toHaveLength(1);
  });

  it('never mutates shared rows while handing each consumer its own values', async () => {
    let snapshot = '';
    let frozen: readonly object[] = [];
    const schema = helperSchema(
      (builder) => {
        const Variant = builder.prismaObject('User', {
          variant: 'UserVariant',
          fields: (t) => ({
            total: t.int({
              select: { posts: { where: { published: 1 } } },
              resolve: (user) => user.posts.length,
            }),
          }),
        });
        builder.prismaObject('User', {
          select: { posts: true },
          fields: (t) => ({
            total: t.int({ resolve: (user) => user.posts.length }),
            chosen: t.relation('posts', { query: { where: { published: 0 } } }),
            variant: t.variant(Variant),
          }),
        });
        builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      },
      (rows) => {
        frozen = deepFreeze(rows);
        snapshot = JSON.stringify(rows);
      },
    );
    const result = await run(schema, '{ users { total chosen { id } variant { total } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { total: 2, chosen: [{ id: 'p-draft1' }], variant: { total: 1 } },
      { total: 2, chosen: [{ id: 'p-bob-draft' }], variant: { total: 1 } },
    ]);
    expect(JSON.stringify(frozen)).toBe(snapshot);
    expect(result.statements).toHaveLength(1);
  });

  it('hands resolvers a parent with its columns as own properties when a relation is combined', async () => {
    const builder = createBuilder();
    const Summary = builder.objectRef<{ firstName: string; posts: readonly { id: string }[] }>(
      'Summary',
    );
    Summary.implement({
      fields: (t) => ({
        first: t.string({ resolve: (summary) => summary.firstName }),
        postCount: t.int({ resolve: (summary) => summary.posts.length }),
      }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        published: t.relation('posts', { query: { where: { published: 1 } } }),
        summary: t.field({
          type: Summary,
          select: { posts: true, firstName: true },
          resolve: (user) => ({ ...user }),
        }),
        keys: t.stringList({
          select: { posts: true, firstName: true },
          resolve: (user) => Object.keys(user).sort(),
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { summary { first postCount } published { id } keys } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0].summary).toEqual({ first: 'Alice', postCount: 2 });
    expect(result.data.users[0].keys).toEqual(expect.arrayContaining(['firstName', 'id', 'posts']));
    expect(result.statements).toHaveLength(1);
  });

  it('never shows a resolver the slots of relations other consumers combined', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        published: t.relation('posts', { query: { where: { published: 1 } } }),
        drafts: t.relation('posts', { query: { where: { published: 0 } } }),
        json: t.string({ select: ['firstName'], resolve: (user) => JSON.stringify(user) }),
        self: t.string({ resolve: (user) => JSON.stringify(user) }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { published { id } drafts { id } json self } }',
    );
    expect(result.errors).toBeUndefined();
    const [user] = result.data.users;
    expect(user.published).toEqual([{ id: 'p-hello' }]);
    expect(user.drafts).toEqual([{ id: 'p-draft1' }]);
    for (const serialized of [user.json, user.self]) {
      expect(JSON.parse(serialized)).toMatchObject({ id: 'u-alice', firstName: 'Alice' });
      expect(JSON.parse(serialized)).not.toHaveProperty('posts');
    }
    expect(result.statements).toHaveLength(1);
  });

  it('hands t.variant fields the parent row itself', async () => {
    const builder = createBuilder();
    const Variant = builder.prismaObject('User', {
      variant: 'UserVariant',
      select: ['firstName'],
      fields: (t) => ({
        spread: t.string({ resolve: (user) => ({ ...user }).firstName }),
      }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id'), variant: t.variant(Variant) }),
    });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], collection: () => db.orm.User }) }),
    });
    const result = await run(builder.toSchema(), '{ users { variant { spread } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { variant: { spread: 'Alice' } },
      { variant: { spread: 'Bob' } },
    ]);
  });

  it('preserves filtered aliases alongside type-level relation rows', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      select: { posts: true },
      fields: (t) => ({
        total: t.int({ resolve: (user) => user.posts.length }),
        latest: t.relation('posts', { query: { orderBy: { createdAt: 'desc' }, limit: 1 } }),
        posts: t.relation('posts', {
          query: { where: { published: 1 }, orderBy: { id: 'desc' }, limit: 1 },
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], collection: () => db.orm.User }) }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { total latest { id } a: posts { id } b: posts { id } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { total: 2, latest: [{ id: 'p-draft1' }], a: [{ id: 'p-hello' }], b: [{ id: 'p-hello' }] },
      { total: 2, latest: [{ id: 'p-bob-draft' }], a: [{ id: 'p-bob1' }], b: [{ id: 'p-bob1' }] },
    ]);
  });

  it('reads type-level relations across connection, relation and node boundaries', async () => {
    const builder = createBuilder();
    builder.prismaNode('User', {
      id: { field: 'id' },
      collection: () => db.orm.User,
      select: { posts: true },
      fields: (t) => ({
        total: t.int({ resolve: (user) => user.posts.length }),
        postsPage: t.relatedConnection('posts', {
          query: { where: { published: 1 } },
          totalCount: true,
        }),
      }),
    });
    builder.prismaObject('Post', {
      select: { comments: true },
      fields: (t) => ({
        author: t.relation('author'),
        commentsTotal: t.int({ resolve: (post) => post.comments.length }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], collection: () => db.orm.User }),
        posts: t.prismaField({ type: ['Post'], collection: () => db.orm.Post }),
        page: t.prismaConnection({
          type: 'User',
          totalCount: true,
          collection: () => db.orm.User,
        }),
      }),
    });
    const id = Buffer.from('User:u-alice').toString('base64');
    const result = await run(
      builder.toSchema(),
      `{
        users { total postsPage(first: 1) { totalCount edges { node { commentsTotal } } } }
        posts { author { total } }
        page(first: 1) { totalCount edges { node { total } } }
        node(id: "${id}") { ... on User { total } }
      }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [
        { total: 2, postsPage: { totalCount: 1, edges: [{ node: { commentsTotal: 2 } }] } },
        { total: 2, postsPage: { totalCount: 1, edges: [{ node: { commentsTotal: 0 } }] } },
      ],
      posts: Array.from({ length: 4 }, () => ({ author: { total: 2 } })),
      page: { totalCount: 2, edges: [{ node: { total: 2 } }] },
      node: { total: 2 },
    });
  });
});

describe('model members named like plugin slots', () => {
  const collision = useCollisionDb();

  function schema() {
    const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
      plugins: [RelayPlugin, PrismaNextPlugin],
      relay: {},
      prismaNext: { client: collision.client },
    });
    builder.prismaObject('Row', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
    const Sheet = builder.prismaObject('Sheet', {
      fields: (t) => ({
        count: t.exposeInt('count', { nullable: true }),
        rowsRel: t.relation('rows'),
        notes: t.relatedConnection('notes', { totalCount: true }),
        meta: t.string({
          nullable: true,
          select: ['meta'],
          resolve: (sheet) => JSON.stringify(sheet.meta),
        }),
        role: t.string({ nullable: true, select: { role: true }, resolve: (sheet) => sheet.role }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        sheet: t.prismaField({ type: 'Sheet', collection: () => collision.orm.Sheet }),
        handBuilt: t.field({
          type: Sheet,
          // @ts-expect-error a row built by hand isn't planned; it reloads
          resolve: () => ({ id: 1, name: 's1', count: 99, notes: [] }),
        }),
      }),
    });
    return builder.toSchema();
  }

  it('does not read a relation named rows as the connection rows', async () => {
    const result = await run(
      schema(),
      '{ sheet { rowsRel { id } notes(first: 5) { edges { node { id __typename } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.sheet).toEqual({
      rowsRel: [{ id: '10' }, { id: '11' }],
      notes: {
        edges: [
          { node: { id: '20', __typename: 'Note' } },
          { node: { id: '21', __typename: 'Note' } },
        ],
      },
    });
  });

  it('does not read a column named count as the connection total', async () => {
    const result = await run(schema(), '{ sheet { count notes(first: 1) { totalCount } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.sheet).toEqual({ count: 99, notes: { totalCount: 2 } });
    const handBuilt = await run(schema(), '{ handBuilt { count notes(first: 1) { totalCount } } }');
    expect(handBuilt.errors).toBeUndefined();
    expect(handBuilt.data.handBuilt).toEqual({ count: 99, notes: { totalCount: 2 } });
  });

  const meta = JSON.stringify({ 'role:role': 'admin', 'x:role': 'admin' });
  it.each([
    ['{ sheet { meta role } }', { meta, role: 'user' }],
    ['{ sheet { meta x: role } }', { meta, x: 'user' }],
    ['{ sheet { role } }', { role: 'user' }],
  ])('ignores JSON keys shaped like planned values: %s', async (source, sheet) => {
    const result = await run(schema(), source);
    expect(result.errors).toBeUndefined();
    expect(result.data.sheet).toEqual(sheet);
  });
});
