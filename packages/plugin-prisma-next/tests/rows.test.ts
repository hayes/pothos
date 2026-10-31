import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
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
      fields: (t) => ({ user: t.field({ type: User, resolve: () => parent as never }) }),
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
        stale: t.field({ type: Post, resolve: () => ({ id: 'p-hello', title: 'kept' }) as never }),
        deleted: t.field({
          type: Post,
          resolve: () => ({ id: 'gone', title: 'deleted' }) as never,
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
          select: { author: true },
          resolve: (post) => ({ id: post.author.id }) as never,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        post: t.prismaField({
          type: 'Post',
          resolve: () => db.orm.Post.where({ id: 'p-hello' }),
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
});

describe('rows the plugin loaded', () => {
  function helperSchema(
    configure: (builder: ReturnType<typeof createBuilder>) => void,
    onRows: (rows: readonly { id: string }[]) => void,
  ) {
    const builder = createBuilder();
    configure(builder);
    const helper = prismaConnectionHelpers(builder, 'User', { cursor: 'id' });
    builder.queryType({
      fields: (t) => ({
        users: t.connection({
          type: helper.ref,
          args: helper.getArgs(),
          resolve: async (_root, args, context, info) => {
            const page = await helper.applyPagination(db.orm.User, args, info, context);
            const rows = await page.collection.all();
            onRows(rows);
            return page.wrap(rows);
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
    const result = await run(schema, '{ users { nodes { label } } }');
    expect(result.data.users.nodes).toEqual([
      { label: 'cached u-alice' },
      { label: 'cached u-bob' },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('never mutates shared rows while handing each consumer its own values', async () => {
    let snapshot = '';
    let frozen: readonly object[] = [];
    const schema = helperSchema(
      (builder) => {
        const Variant = builder.prismaObject('User', {
          variant: 'UserVariant',
          select: { posts: { where: { published: 1 } } },
          fields: (t) => ({ total: t.int({ resolve: (user) => user.posts.length }) }),
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
    const result = await run(
      schema,
      '{ users { nodes { total chosen { id } variant { total } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users.nodes).toEqual([
      { total: 2, chosen: [{ id: 'p-draft1' }], variant: { total: 1 } },
      { total: 2, chosen: [{ id: 'p-bob-draft' }], variant: { total: 1 } },
    ]);
    expect(JSON.stringify(frozen)).toBe(snapshot);
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
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
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
        latest: t.relation('posts', { query: { orderBy: (p) => p.createdAt.desc(), limit: 1 } }),
        posts: t.relation('posts', {
          query: { where: { published: 1 }, orderBy: (p) => p.id.desc(), limit: 1 },
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
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

  it('reads type-level computed values across connection, relation and node boundaries', async () => {
    const builder = createBuilder();
    builder.prismaNode('User', {
      id: { field: 'id' },
      collection: () => db.orm.User,
      select: { posts: (sub) => ({ total: sub.count() }) },
      fields: (t) => ({
        total: t.int({ resolve: (user) => user.total }),
        postsPage: t.relatedConnection('posts', {
          cursor: 'id',
          where: { published: 1 },
          totalCount: true,
        }),
      }),
    });
    builder.prismaObject('Post', {
      select: { comments: (sub) => ({ commentsTotal: sub.count() }) },
      fields: (t) => ({
        author: t.relation('author'),
        commentsTotal: t.int({ resolve: (post) => post.commentsTotal }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
        posts: t.prismaField({ type: ['Post'], resolve: () => db.orm.Post }),
        page: t.prismaConnection({
          type: 'User',
          cursor: 'id',
          totalCount: true,
          resolve: () => db.orm.User,
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
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: collision.client },
    });
    builder.prismaObject('Row', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
    const Sheet = builder.prismaObject('Sheet', {
      fields: (t) => ({
        count: t.exposeInt('count', { nullable: true }),
        rowsRel: t.relation('rows'),
        notes: t.relatedConnection('notes', { cursor: 'id', totalCount: true }),
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
        sheet: t.prismaField({ type: 'Sheet', resolve: () => collision.orm.Sheet }),
        handBuilt: t.field({
          type: Sheet,
          resolve: () => ({ id: 1, name: 's1', count: 99, notes: [] }) as never,
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
    expect(handBuilt.data.handBuilt.count).toBe(99);
    expect(handBuilt.data.handBuilt.notes.totalCount).not.toBe(99);
  });

  it.each([
    '{ sheet { meta role } }',
    '{ sheet { meta x: role } }',
    '{ sheet { role } }',
  ])('ignores JSON keys shaped like planned values: %s', async (source) => {
    const result = await run(schema(), source);
    expect(result.errors).toBeUndefined();
    expect(result.data.sheet.role ?? result.data.sheet.x).toBe('user');
  });
});
