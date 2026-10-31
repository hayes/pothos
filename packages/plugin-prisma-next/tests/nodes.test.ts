import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, type GraphQLObjectType, parse } from 'graphql';
import { describe, expect, expectTypeOf, it } from 'vitest';
import prismaNextPlugin from '../src';
import { createBuilder, globalId, run, useCollisionDb, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

function schema() {
  const builder = createBuilder<{ tag?: string }>();
  const seenContexts: unknown[] = [];
  builder.prismaNode('User', {
    id: { field: 'id' },
    collection: (context) => {
      seenContexts.push(context);
      return db.orm.User;
    },
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      posts: t.relation('posts'),
      postPage: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
    }),
  });
  builder.prismaNode('User', {
    variant: 'AdminUser',
    id: { field: 'id' },
    collection: db.orm.User,
    fields: (t) => ({ lastName: t.exposeString('lastName') }),
  });
  builder.prismaNode('Post', {
    id: { field: 'id' },
    collection: db.orm.Post,
    fields: (t) => ({ title: t.exposeString('title'), author: t.relation('author') }),
  });
  const PostByAuthor = builder.prismaNode('Post', {
    variant: 'PostByAuthor',
    id: { field: ['authorId', 'id'] },
    collection: db.orm.Post,
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  builder.prismaNode('Comment', {
    id: { field: 'id', resolve: (comment) => `comment:${comment.id}` },
    collection: db.orm.Comment,
    fields: (t) => ({ body: t.exposeString('body') }),
  });
  builder.queryType({
    fields: (t) => ({
      user: t.prismaField({ type: 'User', resolve: () => db.orm.User.where({ id: 'u-alice' }) }),
      users: t.prismaConnection({ type: 'User', cursor: 'id', resolve: () => db.orm.User }),
      comment: t.prismaField({
        type: 'Comment',
        resolve: () => db.orm.Comment.where({ id: 'c-1' }),
      }),
      post: t.prismaField({
        type: PostByAuthor,
        resolve: () => db.orm.Post.where({ id: 'p-hello' }),
      }),
    }),
  });
  return { schema: builder.toSchema(), seenContexts };
}

const query = (source: string, variables?: Record<string, unknown>, context = {}) =>
  run(schema().schema, source, { variables, context });

describe('Relay nodes', () => {
  it('resolves node types through root, related and connection fields', async () => {
    const result = await query(`{
      user { id firstName posts { title author { firstName } } postPage(first: 1) { nodes { title } } }
      users(first: 1) { nodes { firstName } }
    }`);
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: {
        id: globalId('User', 'u-alice'),
        firstName: 'Alice',
        posts: [
          { title: 'Hello, Pothos', author: { firstName: 'Alice' } },
          { title: 'Draft #1', author: { firstName: 'Alice' } },
        ],
        postPage: { nodes: [{ title: 'Draft #1' }] },
      },
      users: { nodes: [{ firstName: 'Alice' }] },
    });
    expect(result.statements).toHaveLength(2);
  });

  it('loads node(id) with its nested relations planned', async () => {
    const result = await query(
      'query ($id: ID!) { node(id: $id) { __typename ... on Post { title author { firstName } } } }',
      { id: globalId('Post', 'p-hello') },
    );
    expect(result.data).toEqual({
      node: { __typename: 'Post', title: 'Hello, Pothos', author: { firstName: 'Alice' } },
    });
    expect(result.statements).toHaveLength(1);
  });

  it('round trips compound IDs, and encodes what a custom id.resolve returns', async () => {
    const ids = await query('{ post { id } comment { id } }');
    expect(ids.data.comment.id).toBe(globalId('Comment', 'comment:c-1'));
    const result = await query(
      'query ($id: ID!) { node(id: $id) { __typename ... on PostByAuthor { title } } }',
      { id: ids.data.post.id },
    );
    expect(result.data).toEqual({ node: { __typename: 'PostByAuthor', title: 'Hello, Pothos' } });
  });

  it.each([
    ['malformed', 'PNI:MARKER-not-a-chunk', /ID payload is invalid/],
    ['short', JSON.stringify(['MARKER']), /expected 2 values, got 1/],
  ])('rejects a %s compound ID without echoing it', async (_name, payload, message) => {
    const result = await query('query ($id: ID!) { node(id: $id) { id } }', {
      id: globalId('PostByAuthor', payload),
    });
    expect(result.errors?.[0].message).toMatch(message);
    expect(result.errors?.[0].message).not.toContain('MARKER');
    expect(result.statements).toHaveLength(0);
  });
  it('refuses to issue an ID longer than it accepts back', async () => {
    const builder = createBuilder();
    const Person = builder.prismaNode('User', {
      id: { field: 'id' },
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        person: t.field({ type: Person, resolve: () => ({ id: 'x'.repeat(2049) }) as never }),
      }),
    });
    const result = await run(builder.toSchema(), '{ person { id } }');
    expect(result.errors?.[0].message).toBe(
      "prismaNode 'User' ID is 2049 characters, over the 2048-character limit for IDs it can load back.",
    );
  });

  it('rejects an ID over the size cap without echoing it or running the collection', async () => {
    const result = await query('query ($id: ID!) { node(id: $id) { id } }', {
      id: globalId('User', `MARKER${'x'.repeat(4000)}`),
    });
    expect(result.errors?.[0].message).toMatch(/ID is longer than 2048 characters/);
    expect(result.errors?.[0].message).not.toContain('MARKER');
    expect(result.statements).toHaveLength(0);
  });
});

describe('node batching', () => {
  const users = (field: string) => (statements: { sql: string }[]) =>
    statements.filter(({ sql }) => new RegExp(`FROM "${field}"`).test(sql));

  it('loads list elements of one path in one query, with null for a missing row', async () => {
    const result = await query(
      'query ($ids: [ID!]!) { nodes(ids: $ids) { ... on User { firstName } } }',
      { ids: ['u-alice', 'u-missing', 'u-bob'].map((id) => globalId('User', id)) },
    );
    expect(result.data.nodes).toEqual([{ firstName: 'Alice' }, null, { firstName: 'Bob' }]);
    expect(users('user')(result.statements)).toHaveLength(1);
    expect(result.statements[0].params).toEqual(expect.arrayContaining(['u-alice', 'u-bob']));
  });

  it('keeps aliases, types and variants in separate batches', async () => {
    const result = await query(
      `query ($a: ID!, $b: ID!, $p: ID!, $v: ID!) {
        a: node(id: $a) { ... on User { firstName } }
        b: node(id: $b) { ... on User { firstName } }
        p: node(id: $p) { ... on Post { title } }
        v: node(id: $v) { __typename ... on AdminUser { lastName } }
      }`,
      {
        a: globalId('User', 'u-alice'),
        b: globalId('User', 'u-bob'),
        p: globalId('Post', 'p-hello'),
        v: globalId('AdminUser', 'u-bob'),
      },
    );
    expect(result.data).toEqual({
      a: { firstName: 'Alice' },
      b: { firstName: 'Bob' },
      p: { title: 'Hello, Pothos' },
      v: { __typename: 'AdminUser', lastName: 'Brown' },
    });
    expect(users('user')(result.statements)).toHaveLength(3);
    expect(users('post')(result.statements)).toHaveLength(1);
  });

  it('keeps a variant in its own batch within one list', async () => {
    const result = await query(
      'query ($ids: [ID!]!) { nodes(ids: $ids) { __typename ... on User { firstName } ... on AdminUser { lastName } } }',
      { ids: [globalId('User', 'u-alice'), globalId('AdminUser', 'u-bob')] },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.nodes).toEqual([
      { __typename: 'User', firstName: 'Alice' },
      { __typename: 'AdminUser', lastName: 'Brown' },
    ]);
    expect(users('user')(result.statements)).toHaveLength(2);
  });

  it('calls a collection callback once per batch with the request context', async () => {
    const { schema: s, seenContexts } = schema();
    const result = await run(
      s,
      'query ($ids: [ID!]!) { nodes(ids: $ids) { ... on User { firstName } } }',
      {
        variables: { ids: [globalId('User', 'u-alice'), globalId('User', 'u-bob')] },
        context: { tag: 'req-1' },
      },
    );
    expect(result.errors).toBeUndefined();
    expect(seenContexts).toEqual([{ tag: 'req-1' }]);
  });
});

describe('node declarations', () => {
  const collision = useCollisionDb();

  it('requires id.field to be a complete non-null primary or unique key', async () => {
    const { default: SchemaBuilder } = await import('@pothos/core');
    const { default: RelayPlugin } = await import('@pothos/plugin-relay');
    const { default: prismaNextPlugin } = await import('../src');
    const node = (field: 'id' | 'text' | 'uniq' | ['id', 'text']) => {
      const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
        plugins: [RelayPlugin, prismaNextPlugin],
        relay: {},
        prismaNext: { client: collision.client },
      });
      builder.prismaNode('Note', {
        id: { field: field as never },
        collection: () => collision.orm.Note,
        fields: (t) => ({ text: t.exposeString('text', { nullable: true }) }),
      });
    };
    expect(() => node('text')).toThrow(/id\.field .*non-null primary or unique key/);
    expect(() => node('uniq')).toThrow(/id\.field .*non-null primary or unique key/);
    expect(() => node(['id', 'text'])).toThrow(/id\.field .*non-null/);
    expect(() => node('id')).not.toThrow();
  });

  it("loads through the client's collection by default", async () => {
    const builder = createBuilder();
    builder.prismaNode('User', {
      id: { field: 'id' },
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({});
    const result = await run(
      builder.toSchema(),
      'query ($id: ID!) { node(id: $id) { ... on User { firstName } } }',
      { variables: { id: globalId('User', 'u-bob') } },
    );
    expect(result.data).toEqual({ node: { firstName: 'Bob' } });
  });

  it('decodes IDs for globalID arguments that name the node', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { client: collision.client },
    });
    const Note = builder.prismaNode('Note', {
      id: { field: 'id' },
      fields: (t) => ({ text: t.exposeString('text', { nullable: true }) }),
    });
    const seen: unknown[] = [];
    builder.queryType({
      fields: (t) => ({
        note: t.prismaField({ type: Note, resolve: () => collision.orm.Note.where({ id: 20 }) }),
        echo: t.string({
          args: { id: t.arg.globalID({ for: Note, required: true }) },
          resolve: (_root, args) => {
            expectTypeOf(args.id.id).toEqualTypeOf<number>();
            seen.push(args.id.id);
            return args.id.typename;
          },
        }),
      }),
    });
    const schema = builder.toSchema();
    const note = await run(schema, '{ note { id } }');
    const result = await run(schema, 'query ($id: ID!) { echo(id: $id) node(id: $id) { id } }', {
      variables: { id: note.data.note.id },
    });
    expect(result.errors).toBeUndefined();
    expect(result.data.echo).toBe('Note');
    expect(seen).toEqual([20]);
  });

  it('keeps a user isTypeOf, sync or async', async () => {
    const builder = createBuilder();
    builder.prismaNode('User', {
      id: { field: 'id' },
      collection: db.orm.User,
      isTypeOf: (value) => (value as { isUser?: boolean }).isUser === true,
      fields: (t) => ({ name: t.exposeString('firstName') }),
    });
    builder.prismaNode('Post', {
      id: { field: 'id' },
      collection: db.orm.Post,
      isTypeOf: async () => false,
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({});
    const types = builder.toSchema().getTypeMap();
    const isTypeOf = (name: string, value: object) =>
      (types[name] as GraphQLObjectType).isTypeOf!(value, {}, {} as never);
    expect(isTypeOf('User', { isUser: true })).toBe(true);
    expect(isTypeOf('User', {})).toBe(false);
    expect(await isTypeOf('Post', {})).toBe(false);
  });
});

describe('ID values', () => {
  function recordingCollection(rows: object[]) {
    const compared: unknown[] = [];
    const column = new Proxy(
      {},
      {
        get: () => (value: unknown) => {
          compared.push(...(Array.isArray(value) ? value : [value]));
          return {};
        },
      },
    );
    const accessor = new Proxy({}, { get: () => column });
    const collection: Record<string, unknown> = {
      where: (filter: unknown) => {
        if (typeof filter === 'function') {
          filter(accessor, {});
        }
        return collection;
      },
      all: async () => rows,
    };
    for (const method of ['select', 'include', 'orderBy', 'limit']) {
      collection[method] = () => collection;
    }
    return { collection, compared };
  }

  async function roundTrip(
    model: 'User' | 'Post',
    rows: Record<string, unknown>[],
    id: Record<string, unknown> & { field: string | string[] },
  ) {
    const { collection, compared } = recordingCollection(rows);
    const builder = createBuilder();
    const Node = builder.prismaNode(model, {
      id: id as never,
      collection: collection as never,
      fields: (t) => ({ label: t.string({ resolve: (row) => (row as { label: string }).label }) }),
    });
    builder.queryType({
      fields: (t) => ({ nodeList: t.field({ type: [Node], resolve: () => rows as never }) }),
    });
    const s = builder.toSchema();
    const listed = await execute({
      schema: s,
      document: parse('{ nodeList { id } }'),
      contextValue: {},
    });
    expect(listed.errors).toBeUndefined();
    const ids = (listed.data as { nodeList: { id: string }[] }).nodeList.map((node) => node.id);
    expect(new Set(ids).size).toBe(rows.length);
    const loaded = await execute({
      schema: s,
      document: parse(`query ($ids: [ID!]!) { nodes(ids: $ids) { ... on ${model} { label } } }`),
      variableValues: { ids },
      contextValue: {},
    });
    expect(loaded.errors).toBeUndefined();
    expect(loaded.data).toEqual({ nodes: rows.map(({ label }) => ({ label })) });
    return compared;
  }

  it('keeps dates their own type, and IDs distinct that differ by a millisecond', async () => {
    const first = new Date('2026-09-10T01:02:03.001Z');
    const second = new Date('2026-09-10T01:02:03.002Z');
    const compared = await roundTrip(
      'Post',
      [
        { id: 'p', createdAt: first, label: 'A' },
        { id: 'p', createdAt: second, label: 'B' },
      ],
      { field: ['id', 'createdAt'] },
    );
    expect(compared).toEqual(['p', first, 'p', second]);
    const parsed = await roundTrip(
      'Post',
      [
        { id: 'p', createdAt: first, label: 'A' },
        { id: 'p', createdAt: second, label: 'B' },
      ],
      {
        field: ['id', 'createdAt'],
        parse: (id: string) => {
          const [postId, at] = JSON.parse(id) as [string, string];
          return [postId, new Date(at)];
        },
        resolve: (row: { id: string; createdAt: Date }) =>
          JSON.stringify([row.id, row.createdAt.toISOString()]),
      },
    );
    expect(parsed).toEqual(['p', first, 'p', second]);
  });

  it('escapes a string ID shaped like a typed payload', async () => {
    expect(await roundTrip('User', [{ id: 'PNI:N:42', label: 'A' }], { field: 'id' })).toEqual([
      'PNI:N:42',
    ]);
  });

  it('keeps the raw value for a custom parser or id resolver', async () => {
    expect(
      await roundTrip('User', [{ id: 'alice', label: 'A' }], {
        field: 'id',
        parse: (id: string) => id.toLowerCase(),
      }),
    ).toEqual(['alice']);
    expect(
      await roundTrip('User', [{ id: 'u-42', label: 'A' }], {
        field: 'id',
        parse: (id: string) => `u-${id}`,
        resolve: (row: { id: string }) => row.id.slice(2),
      }),
    ).toEqual(['u-42']);
    expect(
      await roundTrip('User', [{ id: '42', label: 'A' }], {
        field: 'id',
        resolve: (row: { id: string }) => `${row.id}`,
      }),
    ).toEqual(['42']);
  });

  it('refuses to encode an ID value its column codec does not hold', async () => {
    const builder = createBuilder();
    const Person = builder.prismaNode('User', {
      id: { field: 'id' },
      collection: (() => {
        throw new Error('The query should not run');
      }) as never,
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        person: t.field({ type: Person, resolve: () => ({ id: { value: 'opaque' } }) as never }),
      }),
    });
    const result = await run(builder.toSchema(), '{ person { id } }');
    expect(result.errors?.[0].message).toBe("prismaNode 'User' row has an invalid id value.");
  });

  it('rejects an ID its column codec cannot decode before running the collection', async () => {
    const builder = createBuilder();
    builder.prismaNode('Post', {
      id: { field: ['id', 'createdAt'] },
      collection: (() => {
        throw new Error('The query should not run');
      }) as never,
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({});
    const result = await run(builder.toSchema(), 'query ($id: ID!) { node(id: $id) { id } }', {
      variables: { id: globalId('Post', 'PNI:T:["S:p","S:MARKER"]') },
    });
    expect(result.errors?.[0].message).toBe("prismaNode 'Post' ID has an invalid createdAt value.");
    expect(result.statements).toHaveLength(0);
  });
});
