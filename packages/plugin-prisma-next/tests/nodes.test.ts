import { execute, type GraphQLObjectType, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
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
    ['malformed', 'MARKER-not-json', /ID payload is invalid/],
    ['short', JSON.stringify(['MARKER']), /expected 2 values, got 1/],
  ])('rejects a %s compound ID without echoing it', async (_name, payload, message) => {
    const result = await query('query ($id: ID!) { node(id: $id) { id } }', {
      id: globalId('PostByAuthor', payload),
    });
    expect(result.errors?.[0].message).toMatch(message);
    expect(result.errors?.[0].message).not.toContain('MARKER');
    expect(result.statements).toHaveLength(0);
  });
  it('rejects an ID over the size cap without echoing it or running the collection', async () => {
    const result = await query('query ($id: ID!) { node(id: $id) { id } }', {
      id: globalId('User', `MARKER${'x'.repeat(4000)}`),
    });
    expect(result.errors?.[0].message).toMatch(/ID payload exceeds/);
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
        prismaNext: { contract: collision.contract },
      });
      builder.prismaNode('Note', {
        id: { field },
        collection: () => collision.orm.Note,
        fields: (t) => ({ text: t.exposeString('text', { nullable: true }) }),
      });
    };
    expect(() => node('text')).toThrow(/id\.field .*non-null primary or unique key/);
    expect(() => node('uniq')).toThrow(/id\.field .*non-null primary or unique key/);
    expect(() => node(['id', 'text'])).toThrow(/id\.field .*non-null/);
    expect(() => node('id')).not.toThrow();
  });

  it('requires a collection', () => {
    expect(() =>
      // @ts-expect-error `collection` is required
      createBuilder().prismaNode('User', {
        id: { field: 'id' },
        fields: (t) => ({ firstName: t.exposeString('firstName') }),
      }),
    ).toThrow(/requires a `collection` option/);
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
    rows: Record<string, unknown>[],
    id: Record<string, unknown> & { field: string | string[] },
  ) {
    const { collection, compared } = recordingCollection(rows);
    const builder = createBuilder();
    const Person = builder.prismaNode('User', {
      id: id as never,
      collection: collection as never,
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({ people: t.field({ type: [Person], resolve: () => rows as never }) }),
    });
    const s = builder.toSchema();
    const listed = await execute({
      schema: s,
      document: parse('{ people { id } }'),
      contextValue: {},
    });
    expect(listed.errors).toBeUndefined();
    const ids = (listed.data as { people: { id: string }[] }).people.map((person) => person.id);
    expect(new Set(ids).size).toBe(rows.length);
    const loaded = await execute({
      schema: s,
      document: parse('query ($ids: [ID!]!) { nodes(ids: $ids) { ... on User { firstName } } }'),
      variableValues: { ids },
      contextValue: {},
    });
    expect(loaded.errors).toBeUndefined();
    expect(loaded.data).toEqual({ nodes: rows.map(({ firstName }) => ({ firstName })) });
    return compared;
  }

  class Precise {
    constructor(readonly text: string) {}
  }
  const preciseCodec = {
    encode: (value: Precise) => value.text,
    decode: (text: string) => new Precise(text),
  };
  const bytes = (n: number) => new Uint8Array([n]);

  it('keeps numbers, bigints and dates their own type', async () => {
    expect(await roundTrip([{ id: 42, firstName: 'A' }], { field: 'id' })).toEqual([42]);
    const date = new Date('2026-09-10T01:02:03.456Z');
    const compared = await roundTrip(
      [{ id: BigInt('9007199254740993'), email: date, firstName: 'A' }],
      { field: ['id', 'email'] },
    );
    expect(compared).toEqual([BigInt('9007199254740993'), date]);
  });

  it('keeps IDs distinct that differ by a millisecond or by bytes that are not UTF-8', async () => {
    await roundTrip(
      [
        { id: new Date('2026-09-10T01:02:03.001Z'), firstName: 'A' },
        { id: new Date('2026-09-10T01:02:03.002Z'), firstName: 'B' },
      ],
      { field: 'id' },
    );
    await roundTrip(
      [
        { id: new Date('2026-09-10T01:02:03.001Z'), firstName: 'A' },
        { id: new Date('2026-09-10T01:02:03.002Z'), firstName: 'B' },
      ],
      {
        field: 'id',
        parse: (id: string) => new Date(id),
        resolve: (row: { id: Date }) => row.id.toISOString(),
      },
    );
    for (const wrap of [bytes, (n: number) => Buffer.from([n])]) {
      await roundTrip(
        [
          { id: wrap(255), firstName: 'A' },
          { id: wrap(254), firstName: 'B' },
        ],
        { field: 'id' },
      );
      await roundTrip(
        [
          { id: wrap(255), email: 'same', firstName: 'A' },
          { id: wrap(254), email: 'same', firstName: 'B' },
        ],
        { field: ['id', 'email'] },
      );
    }
  });

  it('escapes a string ID shaped like a typed payload', async () => {
    expect(await roundTrip([{ id: 'PNI:N:42', firstName: 'A' }], { field: 'id' })).toEqual([
      'PNI:N:42',
    ]);
  });

  it('decodes custom scalar IDs through their codec', async () => {
    const compared = await roundTrip(
      [
        { id: new Precise('first'), firstName: 'A' },
        { id: new Precise('second'), firstName: 'B' },
      ],
      { field: 'id', codecs: { id: preciseCodec } },
    );
    expect(compared).toEqual([new Precise('first'), new Precise('second')]);
    expect(compared[0]).toBeInstanceOf(Precise);
  });

  it('keeps the raw value for a custom parser or id resolver', async () => {
    expect(await roundTrip([{ id: 42, firstName: 'A' }], { field: 'id', parse: Number })).toEqual([
      42,
    ]);
    expect(
      await roundTrip([{ id: Buffer.from('alice'), firstName: 'A' }], {
        field: 'id',
        parse: (id: string) => id,
      }),
    ).toEqual(['alice']);
    expect(
      await roundTrip([{ id: 42, firstName: 'A' }], {
        field: 'id',
        resolve: (row: { id: number }) => String(row.id),
      }),
    ).toEqual(['42']);
  });

  it('requires a codec for a custom scalar ID instead of serializing it as JSON', async () => {
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
    expect(result.errors?.[0].message).toBe(
      "prismaNode 'User' requires an id.codecs entry for custom scalar field 'id'.",
    );
  });

  it('rejects an ID its codec cannot decode before running the collection', async () => {
    const builder = createBuilder();
    builder.prismaNode('User', {
      id: {
        field: 'id',
        codecs: {
          id: {
            encode: String,
            decode: (id: string) => {
              throw new Error(`Private payload: ${id}`);
            },
          },
        },
      },
      collection: (() => {
        throw new Error('The query should not run');
      }) as never,
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({});
    const result = await run(builder.toSchema(), 'query ($id: ID!) { node(id: $id) { id } }', {
      variables: { id: globalId('User', 'private-value') },
    });
    expect(result.errors?.[0].message).toBe("prismaNode 'User' ID has an invalid id value.");
  });
});
