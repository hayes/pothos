import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/pg-core';
import type { ExecutionResult } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, queryClient, relations } from './postgres/db';
import { posts, users } from './postgres/db/schema';
import { type RelationShapesFixture, seedRelationShapes } from './postgres/relation-shapes/seed';

// The postgres twin of `id-cursor-validation.test.ts`. Postgres refuses a malformed integer
// parameter itself (`invalid input syntax for type integer`, `value out of range`) with the SQL
// in the error, so here a value has to be refused before it is sent. The cursors of a related
// connection are written from nested rows, which postgres returns through JSON, and have to read
// back like a root row's.

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

builder.drizzleNode('users', {
  name: 'User',
  id: { column: users.id },
  fields: (t) => ({
    name: t.exposeString('name', { nullable: true }),
    postsById: t.relatedConnection('posts', { query: { orderBy: { id: 'asc' } } }),
    // ties on the author, broken by the appended primary key: a compound cursor
    postsByAuthor: t.relatedConnection('posts', { query: { orderBy: { authorId: 'asc' } } }),
  }),
});

builder.drizzleNode('posts', {
  name: 'Post',
  id: { column: posts.id },
  fields: (t) => ({ content: t.exposeString('content', { nullable: true }) }),
});

builder.drizzleNode('posts', {
  variant: 'PostByAuthor',
  id: { column: [posts.id, posts.authorId] },
  fields: (t) => ({ content: t.exposeString('content', { nullable: true }) }),
});

builder.queryType({
  fields: (t) => ({
    postsById: t.drizzleConnection({
      type: 'posts',
      resolve: (query) => db.query.posts.findMany(query({ orderBy: { id: 'desc' } })),
    }),
    postsByAuthor: t.drizzleConnection({
      type: 'posts',
      resolve: (query) => db.query.posts.findMany(query({ orderBy: { authorId: 'asc' } })),
    }),
  }),
});

const schema = builder.toSchema();

const statements: string[] = [];

const session = Object.getPrototypeOf((db as unknown as { _: { session: object } })._.session) as {
  prepareQuery: (...args: unknown[]) => unknown;
};
const prepareQuery = session.prepareQuery;

session.prepareQuery = function patched(this: unknown, ...args: unknown[]) {
  statements.push((args[0] as { sql: string }).sql);

  return prepareQuery.apply(this, args);
};

let fixture: RelationShapesFixture;

beforeAll(async () => {
  fixture = await seedRelationShapes();
});

afterAll(async () => {
  await queryClient.end();
});

async function run(source: string, variableValues: Record<string, unknown> = {}) {
  statements.length = 0;

  const result = (await execute({
    schema,
    document: gql(source),
    variableValues,
    contextValue: {},
  })) as ExecutionResult;

  return { ...result, statements: [...statements] };
}

function globalID(type: string, id: string) {
  return Buffer.from(`${type}:${id}`).toString('base64');
}

function cursor(payload: string) {
  return Buffer.from(payload).toString('base64');
}

function expectRefused(result: Awaited<ReturnType<typeof run>>, message: string) {
  expect(result.errors?.map((error) => error.message)).toEqual([message]);
  expect(result.statements).toEqual([]);
}

interface Page {
  edges: { cursor: string; node: { id: string } }[];
}

const PAGE = 'edges { cursor node { id } }';

describe('node IDs on postgres', () => {
  const nodeQuery = 'query ($id: ID!) { node(id: $id) { id } }';

  it('reads back every ID it writes', async () => {
    for (const id of fixture.userIds) {
      const userID = globalID('User', String(id));
      const result = await run(nodeQuery, { id: userID });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ node: { id: userID } });
    }

    for (const id of fixture.postIds) {
      const postID = globalID('Post', String(id));
      const result = await run(nodeQuery, { id: postID });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ node: { id: postID } });
    }
  });

  it('reads back every compound ID it writes', async () => {
    const rows = await db.query.posts.findMany({ orderBy: { id: 'asc' } });

    for (const row of rows) {
      const id = globalID('PostByAuthor', JSON.stringify([row.id, row.authorId]));
      const result = await run(nodeQuery, { id });

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ node: { id } });
    }
  });

  it('loads the valid IDs of a list beside an invalid one', async () => {
    const [first, second] = fixture.userIds;
    const result = await run('query ($ids: [ID!]!) { nodes(ids: $ids) { id } }', {
      ids: [
        globalID('User', String(first)),
        globalID('User', 'abc'),
        globalID('User', String(second)),
      ],
    });

    expect(result.data).toEqual({
      nodes: [
        { id: globalID('User', String(first)) },
        null,
        { id: globalID('User', String(second)) },
      ],
    });
    expect(result.errors?.map((error) => error.message)).toEqual(['Invalid ID.']);
  });

  it.each([
    ['not a number', 'User', 'abc'],
    ['a fraction', 'User', '1.5'],
    ['outside an integer column', 'User', '2147483648'],
    ['a leading zero', 'User', '01'],
    ['an exponent', 'User', '1e0'],
    ['a fraction in a compound ID', 'PostByAuthor', '[1.5,1]'],
    ['outside an integer column in a compound ID', 'PostByAuthor', '[1,2147483648]'],
    ['a string in a compound ID', 'PostByAuthor', '["1",1]'],
    ['too short a compound ID', 'PostByAuthor', '[1]'],
    ['not JSON', 'PostByAuthor', 'abc'],
  ])('refuses an ID that is %s before any SQL', async (_name, type, id) => {
    const result = await run(nodeQuery, { id: globalID(type, id) });

    expectRefused(result, 'Invalid ID.');
  });
});

describe('cursors on postgres', () => {
  const root = (field: string) =>
    `query ($first: Int, $last: Int, $after: String, $before: String) {
      ${field}(first: $first, last: $last, after: $after, before: $before) { ${PAGE} }
    }`;
  const related = (field: string) =>
    `query ($id: ID!, $first: Int, $last: Int, $after: String, $before: String) {
      node(id: $id) {
        ... on User { ${field}(first: $first, last: $last, after: $after, before: $before) { ${PAGE} } }
      }
    }`;

  async function page(
    connection: 'root' | 'related',
    field: string,
    args: Record<string, unknown>,
  ): Promise<Page> {
    const result =
      connection === 'root'
        ? await run(root(field), args)
        : await run(related(field), { id: globalID('User', String(fixture.authorId)), ...args });

    expect(result.errors).toBeUndefined();

    return connection === 'root'
      ? (result.data as Record<string, Page>)[field]
      : (result.data as { node: Record<string, Page> }).node[field];
  }

  describe.each([
    ['root', 'postsById'],
    ['root', 'postsByAuthor'],
    ['related', 'postsById'],
    ['related', 'postsByAuthor'],
  ] as const)('%s %s', (connection, field) => {
    it('pages forward and backward from every cursor it writes', async () => {
      const all = await page(connection, field, { first: 100 });

      expect(all.edges.length).toBeGreaterThan(2);

      for (const [index, edge] of all.edges.entries()) {
        const after = await page(connection, field, { first: 100, after: edge.cursor });
        const before = await page(connection, field, { last: 100, before: edge.cursor });

        expect(after.edges).toEqual(all.edges.slice(index + 1));
        expect(before.edges).toEqual(all.edges.slice(0, index));
      }
    });
  });

  it.each([
    ['root', 'postsById', 'DC:S:abc'],
    ['root', 'postsById', 'DC:N:1.5'],
    ['root', 'postsById', 'DC:N:2147483648'],
    ['root', 'postsById', 'DC:O:{"a":1}'],
    ['root', 'postsById', 'DC:O:[1]'],
    ['root', 'postsById', 'DC:I:1'],
    ['root', 'postsById', 'DC:D:1'],
    ['root', 'postsByAuthor', 'DC:T:["N:1","S:abc"]'],
    ['root', 'postsByAuthor', 'DC:T:["N:1","N:2","N:3"]'],
    ['root', 'postsByAuthor', 'DC:J:[1,"abc"]'],
    ['related', 'postsById', 'DC:S:abc'],
    ['related', 'postsById', 'DC:N:1.5'],
    ['related', 'postsByAuthor', 'DC:T:["N:2147483648","N:1"]'],
    ['related', 'postsByAuthor', 'DC:O:{}'],
  ] as const)('refuses a %s %s cursor %s before any SQL', async (connection, field, payload) => {
    const after = cursor(payload);
    const result =
      connection === 'root'
        ? await run(root(field), { first: 2, after })
        : await run(related(field), {
            id: globalID('User', String(fixture.authorId)),
            first: 2,
            after,
          });

    expectRefused(result, 'Invalid cursor.');
  });

  it('still reads a legacy J: compound cursor', async () => {
    const all = await page('root', 'postsByAuthor', { first: 100 });
    const tagged = Buffer.from(all.edges[0].cursor, 'base64').toString();
    // the same position as JSON wrote it before each part carried a tag
    const values = (JSON.parse(tagged.slice('DC:T:'.length)) as string[]).map((part) =>
      Number(part.slice(2)),
    );
    const legacy = await page('root', 'postsByAuthor', {
      first: 100,
      after: cursor(`DC:J:${JSON.stringify(values)}`),
    });

    expect(legacy.edges).toEqual(all.edges.slice(1));
  });
});
