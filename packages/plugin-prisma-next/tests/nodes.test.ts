import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { Collection } from '@prisma/orm-family-sql/orm-client';
import sqlite from '@prisma/orm-sqlite/runtime';
import { execute, type GraphQLObjectType, parse } from 'graphql';
import { afterAll, describe, expect, expectTypeOf, it } from 'vitest';
import PrismaNextPlugin from '../src';
import { detailOf } from './fixtures/errors';
import {
  createBuilder,
  globalId,
  run,
  type SampleContract,
  sampleContract,
  useCollisionDb,
  useSampleDb,
} from './fixtures/helpers';
import { createSqliteRuntime } from './fixtures/runtime';

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
      postPage: t.relatedConnection('posts', { totalCount: true }),
    }),
  });
  builder.prismaNode('User', {
    variant: 'AdminUser',
    id: { field: 'id' },
    fields: (t) => ({ lastName: t.exposeString('lastName') }),
  });
  builder.prismaNode('Post', {
    id: { field: 'id' },
    fields: (t) => ({ title: t.exposeString('title'), author: t.relation('author') }),
  });
  const PostByAuthor = builder.prismaNode('Post', {
    variant: 'PostByAuthor',
    id: { field: ['authorId', 'id'] },
    fields: (t) => ({ title: t.exposeString('title') }),
  });
  builder.prismaNode('Comment', {
    id: {
      field: 'id',
      description: 'The comment ID',
      extensions: { audited: true },
      parse: (id) => id.slice('comment:'.length),
      resolve: (comment) => `comment:${comment.id}`,
    },
    fields: (t) => ({ body: t.exposeString('body') }),
  });
  builder.queryType({
    fields: (t) => ({
      user: t.prismaField({ type: 'User', resolve: () => db.orm.User.where({ id: 'u-alice' }) }),
      users: t.prismaConnection({ type: 'User', resolve: () => db.orm.User }),
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
  it("passes the id option's field options to the ID field", () => {
    const id = (schema().schema.getType('Comment') as GraphQLObjectType).getFields().id!;
    expect(id.description).toBe('The comment ID');
    expect(id.extensions).toMatchObject({ audited: true });
  });

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
    const comment = await query('query ($id: ID!) { node(id: $id) { ... on Comment { body } } }', {
      id: ids.data.comment.id,
    });
    expect(comment.errors).toBeUndefined();
    expect(comment.data.node).toEqual({ body: expect.any(String) });
    const result = await query(
      'query ($id: ID!) { node(id: $id) { __typename ... on PostByAuthor { title } } }',
      { id: ids.data.post.id },
    );
    expect(result.data).toEqual({ node: { __typename: 'PostByAuthor', title: 'Hello, Pothos' } });
  });

  it('loads a one-column array ID, and decodes it as a tuple', async () => {
    const builder = createBuilder();
    const Person = builder.prismaNode('User', {
      id: { field: ['id'] },
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    const seen: unknown[] = [];
    builder.queryType({
      fields: (t) => ({
        person: t.prismaField({ type: Person, resolve: () => db.orm.User.where({ id: 'u-bob' }) }),
        echo: t.string({
          args: { id: t.arg.globalID({ for: Person, required: true }) },
          resolve: (_root, args) => {
            expectTypeOf(args.id.id).toEqualTypeOf<[string]>();
            seen.push(args.id.id);
            return args.id.typename;
          },
        }),
      }),
    });
    const schema = builder.toSchema();
    const person = await run(schema, '{ person { id } }');
    expect(person.data.person.id).toBe(globalId('User', 'u-bob'));
    const result = await run(
      schema,
      'query ($id: ID!) { echo(id: $id) node(id: $id) { ... on User { firstName } } }',
      { variables: { id: person.data.person.id } },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ echo: 'User', node: { firstName: 'Bob' } });
    expect(seen).toEqual([['u-bob']]);
  });

  it.each([
    ['malformed', 'MARKER-not-json'],
    ['short', JSON.stringify(['MARKER'])],
  ])('rejects a %s compound ID without echoing it', async (_name, payload) => {
    const result = await query('query ($id: ID!) { node(id: $id) { id } }', {
      id: globalId('PostByAuthor', payload),
    });
    expect(result.errors?.[0].message).toBe('Invalid ID.');
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

  it('batches aliases of one type, and keeps types and variants in separate batches', async () => {
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
    // `a` and `b` load in one statement, the variant `v` in another.
    expect(users('user')(result.statements)).toHaveLength(2);
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

  it('requires id.field to be a complete non-null primary or unique key', () => {
    const node = (field: 'id' | 'text' | 'uniq' | ['id', 'text']) => {
      const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
        plugins: [RelayPlugin, PrismaNextPlugin],
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
      plugins: [RelayPlugin, PrismaNextPlugin],
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
    // The format plugin-prisma uses: an Int is its digits.
    expect(note.data.note.id).toBe(globalId('Note', '20'));
    const result = await run(schema, 'query ($id: ID!) { echo(id: $id) node(id: $id) { id } }', {
      variables: { id: note.data.note.id },
    });
    expect(result.errors).toBeUndefined();
    expect(result.data.echo).toBe('Note');
    expect(seen).toEqual([20]);
  });
});

describe('the collection option', () => {
  const postTitle = 'query ($id: ID!) { node(id: $id) { ... on Post { title } } }';
  const draft = globalId('Post', 'p-draft1');

  it('hides the rows its filter excludes from node(id:), per request', async () => {
    const builder = createBuilder<{ viewer: string }>();
    builder.prismaNode('Post', {
      id: { field: 'id' },
      collection: (ctx) => db.orm.Post.where({ authorId: ctx.viewer }),
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({});
    const s = builder.toSchema();
    const variables = { id: draft };
    const asAuthor = await run(s, postTitle, { variables, context: { viewer: 'u-alice' } });
    expect(asAuthor.data).toEqual({ node: { title: 'Draft #1' } });
    const asOther = await run(s, postTitle, { variables, context: { viewer: 'u-bob' } });
    expect(asOther.errors).toBeUndefined();
    expect(asOther.data).toEqual({ node: null });
  });

  it('does not filter rows reached through t.relation, prismaField or a parent reload', async () => {
    const builder = createBuilder();
    const Post = builder.prismaNode('Post', {
      id: { field: 'id' },
      collection: () => db.orm.Post.where({ id: 'nothing' }),
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.prismaObject('User', {
      fields: (t) => ({ posts: t.relation('posts', { query: { where: { id: 'p-draft1' } } }) }),
    });
    builder.queryType({
      fields: (t) => ({
        post: t.prismaField({
          type: Post,
          resolve: () => db.orm.Post.where({ id: 'p-draft1' }),
        }),
        alice: t.prismaField({
          type: 'User',
          resolve: () => db.orm.User.where({ id: 'u-alice' }),
        }),
        plain: t.field({ type: Post, resolve: () => ({ id: 'p-draft1' }) }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      `query ($id: ID!) {
        node(id: $id) { id }
        post { title }
        alice { posts { title } }
        plain { title }
      }`,
      { variables: { id: draft } },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      node: null,
      post: { title: 'Draft #1' },
      alice: { posts: [{ title: 'Draft #1' }] },
      plain: { title: 'Draft #1' },
    });
  });

  it("loads a node on a client function's transaction", async () => {
    const builder = createBuilder<{ db: Pick<typeof db.client, 'orm'> }>({
      client: (ctx) => ctx.db,
    });
    builder.prismaNode('User', {
      id: { field: 'id' },
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.prismaNode('User', {
      variant: 'FilteredUser',
      id: { field: 'id' },
      collection: (ctx) => ctx.db.orm.User.where({ lastName: 'Uncommitted' }),
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({});
    const s = builder.toSchema();
    const source = `query ($id: ID!, $filtered: ID!) {
      node(id: $id) { ... on User { firstName } }
      filtered: node(id: $filtered) { ... on FilteredUser { firstName } }
    }`;
    const variables = {
      id: globalId('User', 'u-tx'),
      filtered: globalId('FilteredUser', 'u-tx'),
    };
    const rollback = new Error('rollback');
    let inTransaction: unknown;
    await expect(
      db.client.transaction(async (tx) => {
        await tx.orm.User.create({
          id: 'u-tx',
          firstName: 'Tess',
          lastName: 'Uncommitted',
          email: 'tess@example.com',
        });
        const result = await run(s, source, { variables, context: { db: tx } });
        expect(result.errors).toBeUndefined();
        inTransaction = result.data;
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    // Only the transaction's client could see the row, which the rollback removed.
    expect(inTransaction).toEqual({ node: { firstName: 'Tess' }, filtered: { firstName: 'Tess' } });
    const after = await run(s, source, { variables, context: { db: db.client } });
    expect(after.data).toEqual({ node: null, filtered: null });
  });

  it('loads root fields and nodes from a custom Collection subclass', async () => {
    class UserCollection extends Collection<SampleContract, 'User'> {
      named(firstName: string) {
        return this.where({ firstName });
      }
    }
    const client = sqlite({
      contract: sampleContract,
      path: db.path,
      collections: { User: UserCollection },
    });
    try {
      expect(client.orm.User).toBeInstanceOf(UserCollection);
      const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
        plugins: [RelayPlugin, PrismaNextPlugin],
        relay: {},
        prismaNext: { client },
      });
      builder.prismaNode('User', {
        id: { field: 'id' },
        collection: () => client.orm.User.named('Alice'),
        fields: (t) => ({
          firstName: t.exposeString('firstName'),
          posts: t.relation('posts', { query: { where: { id: 'p-hello' } } }),
        }),
      });
      builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
      builder.queryType({
        fields: (t) => ({
          users: t.prismaField({ type: ['User'], resolve: () => client.orm.User.named('Bob') }),
          userPage: t.prismaConnection({
            type: 'User',
            resolve: () => client.orm.User.named('Bob'),
          }),
        }),
      });
      const result = await run(
        builder.toSchema(),
        `query ($alice: ID!, $bob: ID!) {
          users { firstName }
          userPage(first: 1) { edges { node { firstName } } }
          alice: node(id: $alice) { ... on User { firstName posts { title } } }
          bob: node(id: $bob) { ... on User { firstName } }
        }`,
        { variables: { alice: globalId('User', 'u-alice'), bob: globalId('User', 'u-bob') } },
      );
      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        users: [{ firstName: 'Bob' }],
        userPage: { edges: [{ node: { firstName: 'Bob' } }] },
        alice: { firstName: 'Alice', posts: [{ title: 'Hello, Pothos' }] },
        bob: null,
      });
    } finally {
      await client.close();
    }
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
      collection: () => collection as never,
      fields: (t) => ({
        label: t.string({ resolve: (row) => (row as unknown as { label: string }).label }),
      }),
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

  it('keeps a string ID that reads as JSON a string', async () => {
    const rows = [
      { id: '42', label: 'A' },
      { id: '["a"]', label: 'B' },
    ];
    expect(await roundTrip('User', rows, { field: 'id' })).toEqual(['42', '["a"]']);
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

  it('rejects a composite ID whose parser returns the wrong number of values', async () => {
    const builder = createBuilder();
    builder.prismaNode('Post', {
      id: { field: ['authorId', 'id'], parse: (id) => id.split(':').slice(1) },
      collection: (() => {
        throw new Error('The query should not run');
      }) as never,
      fields: (t) => ({ title: t.exposeString('title') }),
    });
    builder.queryType({});
    const result = await run(builder.toSchema(), 'query ($id: ID!) { node(id: $id) { id } }', {
      variables: { id: globalId('Post', 'u-alice:p-hello') },
    });
    expect(result.errors?.[0].message).toBe('Invalid ID.');
    expect(result.statements).toHaveLength(0);
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
    expect(result.errors?.[0].message).toBe('Unexpected error.');
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
      variables: { id: globalId('Post', JSON.stringify(['p', 'MARKER'])) },
    });
    expect(result.errors?.[0].message).toBe('Invalid ID.');
    expect(result.statements).toHaveLength(0);
  });
});

describe('node load errors', () => {
  // The user table lacks the contract's email column.
  const broken = createSqliteRuntime(
    sampleContract,
    `CREATE TABLE user (id TEXT PRIMARY KEY NOT NULL, firstName TEXT NOT NULL,
       lastName TEXT NOT NULL);
     INSERT INTO user (id, firstName, lastName) VALUES ('u-alice', 'Alice', 'Andrews');`,
  );
  afterAll(() => broken.cleanup());

  function brokenSchema() {
    const builder = createBuilder({ client: broken.client });
    builder.prismaNode('User', {
      id: { field: 'id' },
      fields: (t) => ({ email: t.exposeString('email') }),
    });
    builder.queryType({});
    return builder.toSchema();
  }

  it.each([
    ['node', 'query ($id: ID!) { node(id: $id) { ... on User { email } } }'],
    ['nodes', 'query ($id: ID!) { nodes(ids: [$id]) { ... on User { email } } }'],
  ])('keeps a database error from %s out of the response', async (_name, source) => {
    const result = await run(brokenSchema(), source, {
      variables: { id: globalId('User', 'u-alice') },
    });
    expect(result.errors).toHaveLength(1);
    expect(detailOf(result.errors?.[0])).toMatch(/email/);
  });

  it("passes an error a field's select throws through as it is", async () => {
    const builder = createBuilder();
    builder.prismaNode('User', {
      id: { field: 'id' },
      fields: (t) => ({
        guarded: t.string({
          select: () => {
            throw new Error('select failed');
          },
          resolve: () => 'unreachable',
        }),
      }),
    });
    builder.queryType({});
    const result = await run(
      builder.toSchema(),
      'query ($id: ID!) { node(id: $id) { ... on User { guarded } } }',
      { variables: { id: globalId('User', 'u-alice') } },
    );
    expect(result.errors?.map((error) => error.message)).toEqual(['select failed']);
  });

  it('still reports an ID its column codec rejects as invalid', async () => {
    const builder = createBuilder({ client: broken.client });
    builder.prismaNode('User', {
      // Parses to a value the text column's codec rejects when the batch keys it.
      id: { field: 'id', parse: (id) => ({ value: id }) as never },
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({});
    const result = await run(builder.toSchema(), 'query ($id: ID!) { node(id: $id) { id } }', {
      variables: { id: globalId('User', 'u-alice') },
    });
    expect(result.errors?.[0].message).toBe('Invalid ID.');
    expect(result.statements).toHaveLength(0);
  });
});
