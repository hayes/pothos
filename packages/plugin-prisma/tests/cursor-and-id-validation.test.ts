import { encodeGlobalID } from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { type ExecutionResult, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { prisma, queries } from './example/builder';
import schema from './example/schema';

const cursor = (payload: string) => Buffer.from(payload).toString('base64');

async function run(source: string, variables: Record<string, unknown> = {}) {
  queries.length = 0;

  return (await execute({
    schema,
    document: parse(source),
    variableValues: variables,
    contextValue: { user: { id: 1 } },
  })) as ExecutionResult;
}

function serialized(value: unknown) {
  return JSON.stringify(value, (_key, part: unknown) =>
    typeof part === 'bigint' ? part.toString() : part,
  );
}

// The client sees the fixed message alone: not its input, not the model, and not the
// validation error prisma would have written, which carries a file path and a source excerpt.
function expectRejected(result: ExecutionResult, message: string, input: string) {
  expect(result.errors?.map((error) => error.message)).toEqual([message]);
  const text = serialized(result.errors);
  expect(text).not.toContain(input);
  expect(text).not.toMatch(/\.ts|invocation|Prisma|Argument/);
}

const USERS = `
  query ($after: String) {
    userConnection(first: 2, after: $after) {
      edges { node { id } }
    }
  }
`;

const POSTS_BY_CREATED_AT = `
  query ($after: String) {
    me {
      postsConnection(first: 2, oldestFirst: true, after: $after) {
        edges { node { id } }
      }
    }
  }
`;

const POSTS_BY_BIGINT = `
  query ($after: String) {
    postsBigIntCursor(first: 2, after: $after) {
      edges { node { id } }
    }
  }
`;

const COMPOSITE_UNIQUE = `
  query ($after: String) {
    withCompositeConnection(first: 2, after: $after) {
      edges { node { id } }
    }
  }
`;

const FOLLOWING = `
  query ($after: String) {
    me {
      following(first: 2, after: $after) {
        edges { node { from { id } to { id } } }
      }
    }
  }
`;

const HELPER_COMMENTS = `
  query ($after: String) {
    viewer {
      comments(oldestFirst: true, first: 2, after: $after) {
        edges { node { id } }
      }
    }
  }
`;

const NODE = `
  query ($id: ID!) {
    node(id: $id) { __typename id }
  }
`;

const NODES = `
  query ($ids: [ID!]!) {
    nodes(ids: $ids) { __typename id }
  }
`;

// No query with a cursor in it reached prisma.
function expectNoCursorQuery() {
  expect(serialized(queries)).not.toContain('"cursor"');
}

describe('malformed cursors', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each([
    ['a string for an Int column', 'GPC:S:abc'],
    ['a fraction for an Int column', 'GPC:N:1.5'],
    ['an unsafe integer for an Int column', 'GPC:N:9007199254740993'],
    ['NaN for an Int column', 'GPC:N:abc'],
    ['an object for an Int column', 'GPC:O:{"id":1}'],
    ['a null for an Int column', 'GPC:Z:'],
    ['an unknown tag', 'GPC:Q:1'],
    ['another plugin prefix', 'DC:N:1'],
  ])('rejects %s', async (_name, payload) => {
    const result = await run(USERS, { after: cursor(payload) });

    expectRejected(result, 'Invalid cursor', payload);
    expectNoCursorQuery();
  });

  it('rejects a cursor that is not base64', async () => {
    const result = await run(USERS, { after: 'not a cursor!' });

    expectRejected(result, 'Invalid cursor', 'not a cursor');
    expectNoCursorQuery();
  });

  it.each([
    ['a string', 'GPC:S:garbage'],
    ['a number', 'GPC:N:1355270400000'],
    ['an invalid date', 'GPC:D:abc'],
    ['a string holding a number', 'GPC:S:1'],
    ['a string holding a year', 'GPC:S:2020'],
  ])('rejects %s for a DateTime column', async (_name, payload) => {
    const result = await run(POSTS_BY_CREATED_AT, { after: cursor(payload) });

    expectRejected(result, 'Invalid cursor', payload);
    expectNoCursorQuery();
  });

  it.each([
    ['text that is not an integer', 'GPC:S:7abc'],
    ['a fraction', 'GPC:N:1.5'],
    ['a value past the 64-bit range', 'GPC:I:9223372036854775808'],
    ['a value below the 64-bit range', 'GPC:I:-9223372036854775809'],
  ])('rejects %s for a BigInt column', async (_name, payload) => {
    const result = await run(POSTS_BY_BIGINT, { after: cursor(payload) });

    expectRejected(result, 'Invalid cursor', payload);
    expectNoCursorQuery();
  });

  it.each([
    ['too wide', 'GPC:J:["1","1","1"]'],
    ['too narrow', 'GPC:T:["S:1"]'],
    ['not an array', 'GPC:J:{"a":"1"}'],
    ['a number for a String part', 'GPC:J:[1,"1"]'],
    ['a null part', 'GPC:T:[null,"S:1"]'],
  ])('rejects a compound cursor that is %s', async (_name, payload) => {
    const result = await run(COMPOSITE_UNIQUE, { after: cursor(payload) });

    expectRejected(result, 'Invalid cursor', payload);
    expectNoCursorQuery();
  });

  it('rejects a compound primary key cursor holding a string for an Int part', async () => {
    const payload = 'GPC:J:["1",2]';
    const result = await run(FOLLOWING, { after: cursor(payload) });

    expectRejected(result, 'Invalid cursor', payload);
    expectNoCursorQuery();
  });

  it('rejects a forged cursor in a prismaConnectionHelpers connection', async () => {
    const payload = 'GPC:S:abc';
    const result = await run(HELPER_COMMENTS, { after: cursor(payload) });

    expectRejected(result, 'Invalid cursor', payload);
    expectNoCursorQuery();
  });
});

describe('cursors the plugin wrote', () => {
  // Each of these is a form the plugin has written, now or before tagged compound cursors.
  // The expected rows are what `origin/main` returns for the same cursor.
  it.each([['N:', 'GPC:N:1']])('pages an Int column from %s', async (_name, payload) => {
    const result = await run(USERS, { after: cursor(payload) });

    expect(result).toEqual({
      data: {
        userConnection: {
          edges: [
            { node: { id: encodeGlobalID('User', 2) } },
            { node: { id: encodeGlobalID('User', 3) } },
          ],
        },
      },
    });
  });

  it.each([
    ['an I: bigint', 'GPC:I:0'],
    ['an N: number', 'GPC:N:0'],
  ])('pages a BigInt column from %s', async (_name, payload) => {
    const result = await run(POSTS_BY_BIGINT, { after: cursor(payload) });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      postsBigIntCursor: {
        edges: [{ node: { id: '2' } }, { node: { id: '3' } }],
      },
    });
  });

  it('pages a DateTime column from a D: cursor', async () => {
    const result = await run(POSTS_BY_CREATED_AT, { after: cursor('GPC:D:1355270400000') });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      me: {
        postsConnection: {
          edges: [{ node: { id: '2' } }, { node: { id: '3' } }],
        },
      },
    });
  });

  it.each([
    ['J:', 'GPC:J:["1","1"]'],
    ['T:', 'GPC:T:["S:1","S:1"]'],
  ])('pages a compound unique from a %s cursor', async (_name, payload) => {
    const result = await run(COMPOSITE_UNIQUE, { after: cursor(payload) });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      withCompositeConnection: {
        edges: [
          { node: { id: encodeGlobalID('WithCompositeUniqueNodeSelect', '["2","2"]') } },
          { node: { id: encodeGlobalID('WithCompositeUniqueNodeSelect', '["3","3"]') } },
        ],
      },
    });
  });

  it.each([
    ['J:', 'GPC:J:[1,2]'],
    ['T:', 'GPC:T:["N:1","N:2"]'],
  ])('pages a compound primary key from a %s cursor', async (_name, payload) => {
    const result = await run(FOLLOWING, { after: cursor(payload) });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      me: {
        following: {
          edges: [
            {
              node: {
                from: { id: encodeGlobalID('User', 1) },
                to: { id: encodeGlobalID('User', 21) },
              },
            },
            {
              node: {
                from: { id: encodeGlobalID('User', 1) },
                to: { id: encodeGlobalID('User', 30) },
              },
            },
          ],
        },
      },
    });
  });

  // A `J:` compound cursor holds a date as its ISO string, which is now read into a Date before
  // prisma sees it. Prisma pages from the same row either way.
  it('pages from the same row for a date and its ISO string', async () => {
    const at = new Date(1_355_270_400_000);
    const page = (createdAt: Date | string) =>
      prisma.post.findMany({ cursor: { createdAt }, take: 2, skip: 1, select: { id: true } });

    expect(await page(at.toISOString())).toEqual(await page(at));
  });

  it('pages a prismaConnectionHelpers connection', async () => {
    const result = await run(HELPER_COMMENTS, { after: cursor('GPC:N:1') });

    expect(result).toEqual({
      data: {
        viewer: { comments: { edges: [{ node: { id: '2' } }, { node: { id: '3' } }] } },
      },
    });
  });
});

describe('malformed node ids', () => {
  it.each([
    ['not a number', 'abc'],
    ['a number followed by text', '1abc'],
    ['a fraction', '1.9'],
    ['an exponent', '1e0'],
    ['a leading zero', '01'],
    ['padded', ' 1'],
  ])('rejects an Int id that is %s', async (_name, id) => {
    const result = await run(NODE, { id: encodeGlobalID('User', id) });

    expectRejected(result, 'Invalid ID', id);
    expect(queries).toEqual([]);
  });

  it('rejects one malformed id in nodes(ids:) without querying it', async () => {
    const result = await run(NODES, {
      ids: [encodeGlobalID('User', 1), encodeGlobalID('User', '1abc')],
    });

    expect(result.errors?.map((error) => error.message)).toEqual(['Invalid ID']);
    expect(serialized(result.errors)).not.toContain('1abc');
    expect(serialized(queries)).not.toContain('1abc');
  });

  it.each([
    ['not JSON', 'abc'],
    ['not an array', '{"a":"1","b":"1"}'],
    ['too short', '["1"]'],
    ['too long', '["1","1","1"]'],
    ['holding a number part', '[1,"1"]'],
    ['holding a null part', '[null,"1"]'],
  ])('rejects a composite id that is %s', async (_name, id) => {
    const result = await run(NODE, { id: encodeGlobalID('WithCompositeIDNode', id) });

    expectRejected(result, 'Invalid ID', id);
    expect(queries).toEqual([]);
  });
});

describe('node ids the plugin wrote', () => {
  it('loads an Int id', async () => {
    const result = await run(NODE, { id: encodeGlobalID('User', 1) });

    expect(result).toEqual({
      data: { node: { __typename: 'User', id: encodeGlobalID('User', 1) } },
    });
  });

  it('loads a negative Int id as a missing row, not an error', async () => {
    const result = await run(NODES, {
      ids: [encodeGlobalID('User', -1)],
    });

    expect(result).toEqual({ data: { nodes: [null] } });
    expect(serialized(queries)).toContain('"id":-1');
  });

  it('loads a composite id', async () => {
    const id = encodeGlobalID('WithCompositeIDNode', '["1","1"]');
    const result = await run(NODE, { id });

    expect(result).toEqual({
      data: { node: { __typename: 'WithCompositeIDNode', id } },
    });
  });

  it('loads a String id', async () => {
    const id = encodeGlobalID('WithIDNode', '1');
    const result = await run(NODE, { id });

    expect(result).toEqual({ data: { node: { __typename: 'WithIDNode', id } } });
  });
});
