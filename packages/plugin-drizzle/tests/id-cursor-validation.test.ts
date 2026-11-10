import { createClient } from '@libsql/client';
import SchemaBuilder, { PothosValidationError } from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { blob, getTableConfig, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { type DocumentNode, type ExecutionResult, GraphQLError } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { getCursorParser } from '../src/utils/cursors';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';
import { userRoles, users } from './example/db/schema';

// Client-supplied node IDs and cursors are checked against the column they are for before any
// SQL runs, and every malformed one gets the same message, naming nothing.

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
});

const User = builder.drizzleNode('users', {
  name: 'User',
  id: { column: users.id },
  fields: (t) => ({
    username: t.exposeString('username'),
    posts: t.relatedConnection('posts', { query: { orderBy: { postId: 'asc' } } }),
    // two columns, so its cursors are compound
    postsByAuthorAndId: t.relatedConnection('posts', {
      query: { orderBy: { authorId: 'asc', postId: 'asc' } },
    }),
  }),
});

builder.drizzleNode('users', {
  variant: 'UserByUsername',
  id: { column: users.username },
  fields: (t) => ({ username: t.exposeString('username') }),
});

builder.drizzleNode('userRoles', {
  name: 'UserRole',
  id: { column: [userRoles.userId, userRoles.roleId] },
  fields: (t) => ({ roleId: t.exposeInt('roleId') }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({ id: t.exposeInt('postId') }),
});

builder.queryType({
  fields: (t) => ({
    username: t.string({
      nullable: true,
      args: { id: t.arg.globalID({ for: User, required: true }) },
      resolve: async (_root, { id }) =>
        (await db.query.users.findFirst({ where: { id: id.id } }))?.username,
    }),
    users: t.drizzleConnection({
      type: User,
      resolve: (query) => db.query.users.findMany(query({ orderBy: { id: 'asc' } })),
    }),
  }),
});

const schema = builder.toSchema();

function globalID(type: string, id: string) {
  return Buffer.from(`${type}:${id}`).toString('base64');
}

function cursor(payload: string) {
  return Buffer.from(payload).toString('base64');
}

async function run(document: DocumentNode, variableValues: Record<string, unknown>) {
  clearDrizzleLogs();

  const result = (await execute({
    schema,
    document,
    variableValues,
    contextValue: {},
  })) as ExecutionResult;

  return { ...result, statements: [...drizzleLogs] };
}

async function expectRejected(
  document: DocumentNode,
  variableValues: Record<string, unknown>,
  message: string,
) {
  const result = await run(document, variableValues);

  expect(result.errors?.map((error) => error.message)).toEqual([message]);
  expect(result.errors?.[0]).toBeInstanceOf(GraphQLError);
  expect(result.statements).toEqual([]);
}

const nodeQuery = gql`
  query ($id: ID!) {
    node(id: $id) {
      id
    }
  }
`;

describe('node IDs', () => {
  it.each([
    ['not a number', 'abc'],
    ['a leading zero', '01'],
    ['an exponent', '1e0'],
    ['hexadecimal', '0x1'],
    ['a leading space', ' 1'],
    ['a fraction digit', '1.0'],
    ['infinite', 'Infinity'],
  ])('rejects an integer ID that is %s', async (_name, id) => {
    await expectRejected(nodeQuery, { id: globalID('User', id) }, 'Invalid ID.');

    const result = await run(nodeQuery, { id: globalID('User', id) });

    expect(result.data).toEqual({ node: null });
  });

  it('accepts the ID it writes', async () => {
    const result = await run(nodeQuery, { id: globalID('User', '1') });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ node: { id: globalID('User', '1') } });
  });

  it('passes any string on for a string column', async () => {
    const result = await run(nodeQuery, { id: globalID('UserByUsername', ' 01 ') });

    expect(result.errors?.map((error) => error.message)).not.toContain('Invalid ID.');
    expect(result.statements).toHaveLength(1);
  });

  it('loads the valid IDs of a list beside an invalid one', async () => {
    const result = await run(
      gql`
        query ($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on User {
              username
            }
          }
        }
      `,
      { ids: [globalID('User', '1'), globalID('User', 'abc'), globalID('User', '2')] },
    );
    const [first, second] = await db.query.users.findMany({
      where: { id: { in: [1, 2] } },
      orderBy: { id: 'asc' },
    });

    expect(result.data).toEqual({
      nodes: [{ username: first.username }, null, { username: second.username }],
    });
    expect(result.errors?.map((error) => ({ message: error.message, path: error.path }))).toEqual([
      { message: 'Invalid ID.', path: ['nodes', 1] },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('rejects an invalid ID passed to a globalID argument', async () => {
    await expectRejected(
      gql`
        query ($id: ID!) {
          username(id: $id)
        }
      `,
      { id: globalID('User', 'abc') },
      'Invalid ID.',
    );
  });

  it.each([
    ['not JSON', 'abc'],
    ['not an array', '{"0":1,"1":2}'],
    ['too short', '[1]'],
    ['too long', '[1,2,3]'],
    ['a string for an integer column', '["1",2]'],
    ['a boolean for an integer column', '[1,true]'],
    ['an object element', '[1,{}]'],
    ['a null element', '[1,null]'],
  ])('rejects a compound ID that is %s', async (_name, id) => {
    await expectRejected(nodeQuery, { id: globalID('UserRole', id) }, 'Invalid ID.');
  });

  it('accepts the compound ID it writes', async () => {
    const result = await run(nodeQuery, { id: globalID('UserRole', '[1,1]') });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ node: { id: globalID('UserRole', '[1,1]') } });
  });
});

const usersPage = gql`
  query ($after: String, $before: String, $first: Int, $last: Int) {
    users(first: $first, after: $after, before: $before, last: $last) {
      edges {
        cursor
        node {
          username
        }
      }
    }
  }
`;

const relatedPage = gql`
  query ($id: ID!, $after: String) {
    node(id: $id) {
      ... on User {
        postsByAuthorAndId(first: 2, after: $after) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  }
`;

describe('cursors', () => {
  it.each([
    ['not base64', '!!!'],
    ['missing the DC: prefix', cursor('N:1')],
    ['an unknown tag', cursor('DC:X:1')],
    ['an undecodable chunk', cursor('DC:T:[')],
    ['a string for an integer column', cursor('DC:S:abc')],
    ['a number in a string', cursor('DC:S:1')],
    ['a bigint for an integer column', cursor('DC:I:1')],
    ['an object', cursor('DC:O:{"a":1}')],
    ['an array', cursor('DC:O:[1]')],
    ['a compound value for one column', cursor('DC:T:["N:1","N:2"]')],
    ['a date', cursor('DC:D:1')],
    ['a boolean', cursor('DC:O:true')],
    ['bytes', cursor('DC:B:AQ==')],
  ])('rejects a cursor that is %s', async (_name, after) => {
    await expectRejected(usersPage, { first: 2, after }, 'Invalid cursor.');
    await expectRejected(usersPage, { last: 2, before: after }, 'Invalid cursor.');
  });

  it('rejects a cursor that is not a string', () => {
    // a String argument never holds anything else, so this is only reachable directly
    expect(() => getCursorParser(['id'], [users.id])(1)).toThrow(
      new PothosValidationError('Invalid cursor.'),
    );
  });

  it('accepts the cursors it writes, forward and backward', async () => {
    const first = await run(usersPage, { first: 2 });
    const [, second] = (
      first.data as { users: { edges: { cursor: string; node: { username: string } }[] } }
    ).users.edges;

    const after = await run(usersPage, { first: 2, after: second.cursor });
    const before = await run(usersPage, { before: second.cursor, last: 1 });

    expect(after.errors).toBeUndefined();
    expect(before.errors).toBeUndefined();
    expect(Buffer.from(second.cursor, 'base64').toString()).toBe('DC:N:2');
    expect(before.data).toEqual({ users: { edges: [first.data!.users.edges[0]] } });
  });

  it('accepts a null cursor value', async () => {
    const result = await run(usersPage, { first: 2, after: cursor('DC:Z:') });

    expect(result.errors).toBeUndefined();
  });

  describe('compound', () => {
    const user = globalID('User', '1');

    it.each([
      ['too many values', cursor('DC:T:["N:1","N:2","N:3"]')],
      ['no values', cursor('DC:T:[]')],
      ['a string for an integer column', cursor('DC:T:["N:1","S:abc"]')],
      ['an object part', cursor('DC:T:["N:1","O:{}"]')],
      ['a legacy part of the wrong type', cursor('DC:J:[1,"2"]')],
      ['a legacy object part', cursor('DC:J:[1,{}]')],
    ])('rejects a cursor with %s', async (_name, after) => {
      const result = await run(relatedPage, { id: user, after });

      // the connection is planned into the user's own query, which never runs
      expect(result.errors?.map((error) => error.message)).toEqual(['Invalid cursor.']);
      expect(result.statements).toEqual([]);
    });

    it.each([
      ['a tagged cursor', 'DC:T:["N:1","N:3"]'],
      ['a legacy J: cursor', 'DC:J:[1,3]'],
      ['a cursor covering a prefix of the ordering', 'DC:T:["N:1"]'],
      ['a legacy cursor covering a prefix of the ordering', 'DC:J:[1]'],
    ])('accepts %s', async (_name, payload) => {
      const result = await run(relatedPage, { id: user, after: cursor(payload) });

      expect(result.errors).toBeUndefined();
    });

    it('compares a null part with is null', async () => {
      const result = await run(relatedPage, { id: user, after: cursor('DC:T:[null,"N:3"]') });

      expect(result.errors).toBeUndefined();
      expect(result.statements[0]).toContain('is null');
    });

    it('pages the compound connection from a legacy cursor as from the tagged one', async () => {
      const tagged = await run(relatedPage, { id: user, after: cursor('DC:T:["N:1","N:3"]') });
      const legacy = await run(relatedPage, { id: user, after: cursor('DC:J:[1,3]') });

      expect(legacy.data).toEqual(tagged.data);
    });
  });
});

describe('column types', () => {
  const client = createClient({ url: ':memory:' });
  const events = sqliteTable('events', {
    id: integer().primaryKey(),
    at: integer({ mode: 'timestamp_ms' }).notNull().unique(),
    big: blob({ mode: 'bigint' }).notNull(),
    flag: integer({ mode: 'boolean' }).notNull(),
    key: blob({ mode: 'buffer' }).notNull(),
  });
  const eventRelations = defineRelations({ events });
  const statements: string[] = [];
  const eventDb = drizzle({
    client,
    relations: eventRelations,
    logger: { logQuery: (query) => statements.push(query) },
  });
  const eventBuilder = new SchemaBuilder<{ DrizzleRelations: typeof eventRelations }>({
    plugins: [RelayPlugin, DrizzlePlugin],
    drizzle: { client: eventDb, relations: eventRelations, getTableConfig },
  });

  eventBuilder.drizzleObject('events', {
    name: 'Event',
    fields: (t) => ({ key: t.exposeInt('id') }),
  });
  eventBuilder.drizzleNode('events', {
    variant: 'EventByDate',
    id: { column: events.at },
    fields: (t) => ({ key: t.exposeInt('id') }),
  });
  eventBuilder.drizzleNode('events', {
    variant: 'EventByIdAndDate',
    id: { column: [events.id, events.at] },
    fields: (t) => ({ key: t.exposeInt('id') }),
  });
  eventBuilder.drizzleNode('events', {
    variant: 'EventByIdAndBig',
    id: { column: [events.id, events.big] },
    fields: (t) => ({ key: t.exposeInt('id') }),
  });

  eventBuilder.queryType({
    fields: (t) => ({
      byDate: t.drizzleConnection({
        type: 'events',
        resolve: (query) => eventDb.query.events.findMany(query({ orderBy: { at: 'asc' } })),
      }),
      byDateAndId: t.drizzleConnection({
        type: 'events',
        resolve: (query) =>
          eventDb.query.events.findMany(query({ orderBy: { at: 'asc', id: 'asc' } })),
      }),
      byBig: t.drizzleConnection({
        type: 'events',
        resolve: (query) => eventDb.query.events.findMany(query({ orderBy: { big: 'asc' } })),
      }),
      byFlag: t.drizzleConnection({
        type: 'events',
        resolve: (query) => eventDb.query.events.findMany(query({ orderBy: { flag: 'asc' } })),
      }),
      byKey: t.drizzleConnection({
        type: 'events',
        resolve: (query) => eventDb.query.events.findMany(query({ orderBy: { key: 'asc' } })),
      }),
    }),
  });

  let eventSchema: ReturnType<typeof eventBuilder.toSchema>;

  beforeAll(async () => {
    await client.execute(
      `create table events (id integer primary key, at integer not null unique,
        big blob not null, flag integer not null, key blob not null)`,
    );
    await eventDb.insert(events).values([
      {
        id: 1,
        at: new Date('2025-01-01T00:00:00.123Z'),
        big: BigInt('9007199254740993'),
        flag: false,
        key: Buffer.from([1]),
      },
      {
        id: 2,
        at: new Date('2025-01-01T00:00:00.124Z'),
        big: BigInt('9007199254740994'),
        flag: true,
        key: Buffer.from([2]),
      },
      {
        id: 3,
        at: new Date('2025-01-01T00:00:00.125Z'),
        big: BigInt('9007199254740995'),
        flag: true,
        key: Buffer.from([3]),
      },
    ]);
    eventSchema = eventBuilder.toSchema();
  });

  afterAll(() => {
    client.close();
  });

  async function runEvents(source: string, variableValues: Record<string, unknown>) {
    statements.length = 0;

    const result = (await execute({
      schema: eventSchema,
      document: gql(source),
      variableValues,
      contextValue: {},
    })) as ExecutionResult;

    return { ...result, statements: [...statements] };
  }

  const eventNode = 'query ($id: ID!) { node(id: $id) { id } }';

  it.each([
    ['not a number', 'abc'],
    ['a fraction', '1735689600123.5'],
    ['a leading zero', '01735689600123'],
    ['an exponent', '1.735689600123e12'],
    ['out of range', '8640000000000001'],
  ])('rejects a date ID that is %s', async (_name, id) => {
    const result = await runEvents(eventNode, { id: globalID('EventByDate', id) });

    expect(result.errors?.map((error) => error.message)).toEqual(['Invalid ID.']);
    expect(result.statements).toEqual([]);
  });

  it('accepts the date ID it writes', async () => {
    const id = globalID('EventByDate', '1735689600123');
    const result = await runEvents(eventNode, { id });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ node: { id } });
  });

  it.each([
    ['EventByIdAndDate', '[1,"abc"]'],
    ['EventByIdAndDate', '[1,1735689600123.5]'],
    ['EventByIdAndDate', '[1,"2025-01-01"]'],
    ['EventByIdAndBig', '[1,"abc"]'],
    ['EventByIdAndBig', '[1,"01"]'],
    ['EventByIdAndBig', '[1,9007199254740993]'],
  ])('rejects the %s ID %s', async (type, id) => {
    const result = await runEvents(eventNode, { id: globalID(type, id) });

    expect(result.errors?.map((error) => error.message)).toEqual(['Invalid ID.']);
    expect(result.statements).toEqual([]);
  });

  it.each([
    '[1,1735689600123]',
    // what compound IDs held before 0.19.1, when JSON wrote the Date
    '[1,"2025-01-01T00:00:00.123Z"]',
  ])('accepts the date compound ID %s', async (id) => {
    const result = await runEvents(eventNode, { id: globalID('EventByIdAndDate', id) });

    expect(result.errors).toBeUndefined();
    // the node's own ID is written the current way
    expect(result.data).toEqual({
      node: { id: globalID('EventByIdAndDate', '[1,1735689600123]') },
    });
  });

  it('accepts the bigint compound ID it writes', async () => {
    const result = await runEvents(eventNode, {
      id: globalID('EventByIdAndBig', '[1,"9007199254740993"]'),
    });

    // The row is not found: the loader binds the bigint to a tuple `in` without the column's
    // blob encoding. That is the loader's; the ID itself is accepted.
    expect(result.errors?.map((error) => error.message)).not.toContain('Invalid ID.');
    expect(result.statements).toHaveLength(1);
  });

  const page = (field: string) =>
    `query ($after: String) { ${field}(first: 2, after: $after) { edges { cursor node { __typename } } } }`;

  it.each([
    ['byDate', 'DC:N:1735689600123'],
    ['byDate', 'DC:S:2025-01-01T00:00:00.123Z'],
    ['byDate', 'DC:D:abc'],
    ['byBig', 'DC:N:1'],
    ['byBig', 'DC:S:9007199254740993'],
    ['byFlag', 'DC:N:1'],
    ['byFlag', 'DC:S:true'],
    ['byKey', 'DC:S:AQ=='],
    ['byKey', 'DC:O:{"type":"Buffer","data":[1]}'],
    ['byDateAndId', 'DC:T:["N:1735689600123","N:1"]'],
    // a legacy cursor never held a number for a date: JSON wrote it as a string
    ['byDateAndId', 'DC:J:[1735689600123,1]'],
    ['byDateAndId', 'DC:J:["2025-01-01",1]'],
  ])('rejects a %s cursor %s', async (field, payload) => {
    const result = await runEvents(page(field), { after: cursor(payload) });

    expect(result.errors?.map((error) => error.message)).toEqual(['Invalid cursor.']);
    expect(result.statements).toEqual([]);
  });

  it.each([
    'byDate',
    'byDateAndId',
    'byBig',
    'byFlag',
    'byKey',
  ])('pages %s from the cursors it writes', async (field) => {
    const first = await runEvents(page(field), {});
    const edges = (first.data as Record<string, { edges: { cursor: string }[] }>)[field].edges;
    const next = await runEvents(page(field), { after: edges[0].cursor });

    expect(next.errors).toBeUndefined();
    expect((next.data as Record<string, { edges: unknown[] }>)[field].edges).toHaveLength(2);
  });

  it('reads a legacy compound cursor holding a date as JSON wrote it', async () => {
    const tagged = await runEvents(page('byDateAndId'), {
      after: cursor('DC:T:["D:1735689600123","N:1"]'),
    });
    const legacy = await runEvents(page('byDateAndId'), {
      after: cursor('DC:J:["2025-01-01T00:00:00.123Z",1]'),
    });

    expect(legacy.errors).toBeUndefined();
    expect(legacy.data).toEqual(tagged.data);
  });
});
