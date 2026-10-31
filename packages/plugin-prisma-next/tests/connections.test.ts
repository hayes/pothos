import { OrderByItem, ParamRef } from '@prisma/orm-family-sql/relational-core/ast';
import { describe, expect, it, vi } from 'vitest';
import { prismaConnectionHelpers } from '../src';
import { buildExampleSchema } from './example/schema';
import {
  type CapturedExecution,
  createBuilder,
  run,
  type SampleOptions,
  useSampleDb,
  withCapture,
} from './fixtures/helpers';

const db = useSampleDb();
const ids = (connection: { edges: { node: { id: string } }[] }) =>
  connection.edges.map((edge) => edge.node.id);

function schema(options: SampleOptions = {}) {
  const builder = createBuilder(options);
  const failing = (message: string) => () => Promise.reject(new Error(message));
  builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      published: t.exposeInt('published'),
    }),
  });
  builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
      posts: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
      postsAlt: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
      published: t.relatedConnection('posts', {
        cursor: 'id',
        totalCount: true,
        query: { where: { published: 1 } },
      }),
      callableCount: t.relatedConnection('posts', { cursor: 'id', totalCount: () => 23 }),
      wrapped: t.relatedConnection('posts', {
        cursor: 'id',
        totalCount: true,
        errors: { types: [] },
      }),
      sized: t.relatedConnection('posts', { cursor: 'id', defaultSize: 1, maxSize: 1 }),
      ordered: t.relatedConnection('posts', {
        cursor: ['title', 'id'],
        args: { newest: t.arg.boolean() },
        query: (args) => ({
          orderBy: (post) => (args.newest ? post.title.desc() : post.title.asc()),
        }),
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
      userPage: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        totalCount: true,
        errors: { types: [] },
        resolve: () => db.orm.User,
      }),
      posts: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        totalCount: true,
        resolve: () => db.orm.Post,
      }),
      postsByDate: t.prismaConnection({
        type: 'Post',
        cursor: ['createdAt', 'id'],
        resolve: () => db.orm.Post,
      }),
      sizedPosts: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        defaultSize: 1,
        maxSize: 2,
        resolve: () => db.orm.Post,
      }),
      orderedPosts: t.prismaConnection({
        type: 'Post',
        cursor: ['title', 'id'],
        args: { newest: t.arg.boolean() },
        orderBy: (post, args) => (args.newest ? post.title.desc() : post.title.asc()),
        resolve: () => db.orm.Post,
      }),
      wrongOrder: t.prismaConnection({
        type: 'Post',
        cursor: ['title', 'id'],
        orderBy: (post) => post.id.asc(),
        resolve: () => db.orm.Post,
      }),
      preordered: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        totalCount: true,
        resolve: () => db.orm.Post.orderBy((post) => post.id.desc()),
      }),
      newestFirst: t.prismaConnection({
        type: 'Post',
        cursor: [{ field: 'createdAt', direction: 'desc' }, 'id'],
        resolve: (_root, args) => {
          // Core pages backward for `last`, or for `before` without `first` or `after`.
          const backward =
            args.first == null && (args.last != null || (!!args.before && !args.after));
          return db.orm.Post.orderBy((post) =>
            backward ? post.createdAt.asc() : post.createdAt.desc(),
          );
        },
      }),
      callableCount: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        totalCount: () => 42,
        resolve: () => db.orm.Post,
      }),
      countRejects: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        totalCount: failing('count-failed'),
        resolve: () => db.orm.Post,
      }),
      rowsReject: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        totalCount: () => 9,
        resolve: failing('rows-failed') as never,
      }),
      countThrows: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        totalCount: (() => {
          throw new Error('sync-throw');
        }) as never,
        resolve: () => db.orm.Post,
      }),
      nullable: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        nullable: true,
        totalCount: true,
        resolve: () => null,
      }),
    }),
  });
  return builder.toSchema();
}

const query = (source: string, variables?: Record<string, unknown>) =>
  run(schema(), source, { variables });

describe('root connections', () => {
  it('returns the first page with edges and pageInfo', async () => {
    const result = await query(`{
      posts(first: 3) {
        edges { cursor node { id } }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const { edges, pageInfo } = result.data.posts;
    expect(ids(result.data.posts)).toEqual(['p-bob-draft', 'p-bob1', 'p-draft1']);
    expect(pageInfo).toEqual({
      hasNextPage: true,
      hasPreviousPage: false,
      startCursor: edges[0].cursor,
      endCursor: edges[2].cursor,
    });
  });

  it('pages forward through every row without gaps or duplicates, then returns an empty page', async () => {
    const seen: string[] = [];
    let after: string | null = null;
    let hasNextPage = true;
    while (hasNextPage) {
      const result = await query(
        'query ($after: String) { posts(first: 1, after: $after) { edges { node { id } } pageInfo { hasNextPage hasPreviousPage endCursor } } }',
        { after },
      );
      seen.push(...ids(result.data.posts));
      expect(result.data.posts.pageInfo.hasPreviousPage).toBe(after !== null);
      ({ hasNextPage, endCursor: after } = result.data.posts.pageInfo);
    }
    expect(seen).toEqual(['p-bob-draft', 'p-bob1', 'p-draft1', 'p-hello']);
    const beyond = await query(
      'query ($after: String) { posts(first: 5, after: $after) { edges { cursor } pageInfo { hasNextPage startCursor endCursor } } }',
      { after },
    );
    expect(beyond.data.posts).toEqual({
      edges: [],
      pageInfo: { hasNextPage: false, startCursor: null, endCursor: null },
    });
  });

  it('pages backward with last and before', async () => {
    const last = await query(
      '{ posts(last: 2) { edges { node { id } } pageInfo { hasPreviousPage hasNextPage startCursor } } }',
    );
    expect(ids(last.data.posts)).toEqual(['p-draft1', 'p-hello']);
    expect(last.data.posts.pageInfo).toMatchObject({ hasPreviousPage: true, hasNextPage: false });
    const before = await query(
      'query ($before: String) { posts(last: 2, before: $before) { edges { node { id } } pageInfo { hasPreviousPage } } }',
      { before: last.data.posts.pageInfo.startCursor },
    );
    expect(ids(before.data.posts)).toEqual(['p-bob-draft', 'p-bob1']);
    expect(before.data.posts.pageInfo.hasPreviousPage).toBe(false);
  });

  it('pages with a compound cursor', async () => {
    const first = await query(
      '{ postsByDate(first: 2) { edges { node { id } } pageInfo { endCursor } } }',
    );
    expect(ids(first.data.postsByDate)).toEqual(['p-hello', 'p-draft1']);
    const second = await query(
      'query ($after: String) { postsByDate(first: 2, after: $after) { edges { node { id } } pageInfo { hasNextPage } } }',
      { after: first.data.postsByDate.pageInfo.endCursor },
    );
    expect(second.data.postsByDate).toEqual({
      edges: [{ node: { id: 'p-bob1' } }, { node: { id: 'p-bob-draft' } }],
      pageInfo: { hasNextPage: false },
    });
  });

  it('passes a null resolver result through a nullable connection', async () => {
    const result = await query('{ nullable { totalCount edges { node { id } } } }');
    expect(result).toMatchObject({ data: { nullable: null }, errors: undefined });
  });
});

describe('related connections', () => {
  it('pages inside the parent statement, forward and backward', async () => {
    const result = await query(`{ users {
      id
      posts(first: 1) { edges { node { id } } pageInfo { hasNextPage } }
      last: posts(last: 1) { edges { node { id } } pageInfo { hasPreviousPage hasNextPage startCursor } }
    } }`);
    expect(result.errors).toBeUndefined();
    expect(result.statements).toHaveLength(1);
    const [alice] = result.data.users;
    expect(alice.posts).toEqual({
      edges: [{ node: { id: 'p-draft1' } }],
      pageInfo: { hasNextPage: true },
    });
    expect(alice.last).toMatchObject({
      edges: [{ node: { id: 'p-hello' } }],
      pageInfo: { hasPreviousPage: true, hasNextPage: false },
    });
    const before = await query(
      'query ($before: String) { users { posts(last: 1, before: $before) { edges { node { id } } pageInfo { hasPreviousPage } } } }',
      { before: alice.last.pageInfo.startCursor },
    );
    expect(before.data.users[0].posts).toEqual({
      edges: [{ node: { id: 'p-draft1' } }],
      pageInfo: { hasPreviousPage: false },
    });
  });

  it('counts each connection independently, applying its where to rows and count alike', async () => {
    const result = await query(`{ users {
      posts(first: 1) { totalCount edges { node { id } } }
      postsAlt(first: 1) { totalCount }
      published(first: 5) { totalCount edges { node { published } } }
      callableCount(first: 1) { totalCount }
    } }`);
    expect(result.errors).toBeUndefined();
    for (const user of result.data.users) {
      expect(user).toMatchObject({
        posts: { totalCount: 2 },
        postsAlt: { totalCount: 2 },
        published: { totalCount: 1, edges: [{ node: { published: 1 } }] },
        callableCount: { totalCount: 23 },
      });
    }
    expect(result.statements).toHaveLength(1);
  });

  it('adds a count to the statement only when totalCount is selected', async () => {
    const rows = await query('{ users { posts(first: 1) { edges { node { id } } } } }');
    expect(rows.errors).toBeUndefined();
    expect(rows.statements).toHaveLength(1);
    expect(rows.statements[0].sql).not.toMatch(/count\(/i);
    const counted = await query('{ users { posts(first: 1) { totalCount } } }');
    expect(counted.statements[0].sql).toMatch(/count\(/i);
  });

  it('counts every related row when filterConnectionTotalCount is false', async () => {
    const result = await run(
      schema({ filterConnectionTotalCount: false }),
      '{ users { published(first: 5) { totalCount edges { node { published } } } } }',
    );
    expect(result.data.users[0].published).toEqual({
      totalCount: 2,
      edges: [{ node: { published: 1 } }],
    });
  });
});

describe('totalCount', () => {
  it('counts the unpaginated collection, or returns the callable result', async () => {
    const result = await query(
      '{ posts(first: 1) { totalCount edges { node { id } } } callableCount(first: 1) { totalCount } }',
    );
    expect(result.data).toEqual({
      posts: { totalCount: 4, edges: [{ node: { id: 'p-bob-draft' } }] },
      callableCount: { totalCount: 42 },
    });
  });

  it('counts once without loading rows through aliases, fragments, directives and wrappers', async () => {
    const result = await query(
      `query ($skip: Boolean!) {
        result: userPage {
          ... on QueryUserPageSuccess { value: data { ...Counts edges @skip(if: $skip) { node { id } } } }
        }
      }
      fragment Counts on QueryUserPageConnection { one: totalCount two: totalCount }`,
      { skip: true },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ result: { value: { one: 2, two: 2 } } });
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).toMatch(/count\(/i);
    expect(result.statements[0].sql).not.toMatch(/limit/i);
  });

  it('omits related rows for count-only selections, including aliased ones in wrappers', async () => {
    const result = await query(`{ users {
      a: wrapped { ... on UserWrappedSuccess { data { n: totalCount } } }
      b: wrapped { ... on UserWrappedSuccess { data { totalCount } } }
    } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual(
      [0, 1].map(() => ({ a: { data: { n: 2 } }, b: { data: { totalCount: 2 } } })),
    );
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).toMatch(/count\(/i);
    expect(result.statements[0].sql).not.toMatch(/limit/i);
  });

  it('does not load the relation when only a callable count is selected', async () => {
    const result = await query('{ users { callableCount { totalCount } } }');
    expect(result.data.users).toEqual([0, 1].map(() => ({ callableCount: { totalCount: 23 } })));
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).not.toMatch(/post|count\(/i);
  });

  it('runs a count only when selected, honoring directives and nested fragments', async () => {
    const skipped = await query(
      `query ($skip: Boolean!) {
        countRejects(first: 1) { edges { node { id } } totalCount @skip(if: $skip) ...Total @include(if: false) }
      }
      fragment Total on QueryCountRejectsConnection { totalCount }`,
      { skip: true },
    );
    expect(skipped.errors).toBeUndefined();
    expect(skipped.data.countRejects.edges).toHaveLength(1);
    const nested = await query(
      `{ countRejects(first: 1) { ...A } }
      fragment A on QueryCountRejectsConnection { ...B }
      fragment B on QueryCountRejectsConnection { totalCount }`,
    );
    expect(nested.errors?.[0].message).toMatch(/count-failed/);
  });

  it.each([
    ['a count rejection', '{ countRejects(first: 1) { totalCount } }', /count-failed/],
    [
      'a rows rejection over a count',
      '{ rowsReject(first: 1) { totalCount edges { node { id } } } }',
      /rows-failed/,
    ],
    ['a count that throws synchronously', '{ countThrows(first: 1) { totalCount } }', /sync-throw/],
  ])('reports %s as a field error', async (_name, source, message) => {
    const result = await query(source);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].message).toMatch(message);
  });
});

describe('page sizes', () => {
  it.each([
    [{ defaultConnectionSize: 1 }, '{ posts { edges { node { id } } } }', 1],
    [{ maxConnectionSize: 2 }, '{ posts(first: 100) { edges { node { id } } } }', 2],
    [{}, '{ sizedPosts { edges { node { id } } } }', 1],
    [{}, '{ sizedPosts(first: 100) { edges { node { id } } } }', 2],
  ])('applies %j to %s', async (options, source, size) => {
    const result = await run(schema(options), source);
    expect(result.errors).toBeUndefined();
    expect(Object.values(result.data)[0]).toMatchObject({
      edges: Array(size).fill(expect.anything()),
    });
  });

  it.each([
    [
      'a zero maxConnectionSize',
      { maxConnectionSize: 0 },
      {},
      /^prismaNext\.maxConnectionSize must be a positive integer, got 0\.$/,
    ],
    [
      'a defaultConnectionSize above the safe integer range',
      { defaultConnectionSize: 1e20 },
      {},
      /^prismaNext\.defaultConnectionSize must be a positive integer, got 100000000000000000000\.$/,
    ],
    ['an unsafe maxSize', {}, { maxSize: 2 ** 53 }, /maxSize must be a positive integer/],
    [
      'a negative defaultSize',
      {},
      { defaultSize: -1 },
      /defaultSize must be a positive integer, got -1/,
    ],
    ['a fractional maxSize', {}, { maxSize: 1.5 }, /maxSize must be a positive integer, got 1.5/],
  ])('rejects %s when the schema is built', (_name, options, sizes, message) => {
    expect(() => {
      const builder = createBuilder(options);
      builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.queryType({
        fields: (t) => ({
          posts: t.prismaConnection({
            type: 'Post',
            cursor: 'id',
            ...sizes,
            resolve: () => db.orm.Post,
          }),
        }),
      });
      builder.toSchema();
    }).toThrow(message);
  });

  it('rejects an invalid plugin page size without any connection fields', () => {
    expect(() => {
      const builder = createBuilder({ defaultConnectionSize: 0 });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      builder.toSchema();
    }).toThrow('prismaNext.defaultConnectionSize must be a positive integer, got 0.');
  });

  it('rejects a size callback result that is not a positive integer before SQL', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaConnection({
          type: 'Post',
          cursor: 'id',
          defaultSize: () => Number.NaN,
          resolve: () => db.orm.Post,
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ posts { edges { node { id } } } }');
    expect(result.errors?.[0].message).toBe(
      'Connection defaultSize callback must return a positive integer, got NaN.',
    );
    expect(result.statements).toHaveLength(0);
  });

  it('applies per-field sizes to related connections', async () => {
    const result = await query(
      '{ users { a: sized { nodes { id } } b: sized(first: 5) { nodes { id } } } }',
    );
    expect(result.data.users[0]).toEqual({
      a: { nodes: [{ id: 'p-draft1' }] },
      b: { nodes: [{ id: 'p-draft1' }] },
    });
  });
});

describe('orderBy', () => {
  const byTitle = ['p-bob-draft', 'p-bob1', 'p-draft1', 'p-hello'];

  it('orders per request and pages through that order in both directions', async () => {
    const up = await query('{ orderedPosts(first: 10) { edges { node { id } } } }');
    expect(ids(up.data.orderedPosts)).toEqual(byTitle);
    const down = await query(
      '{ orderedPosts(first: 2, newest: true) { edges { node { id } } pageInfo { endCursor } } }',
    );
    expect(ids(down.data.orderedPosts)).toEqual(['p-hello', 'p-draft1']);
    const next = await query(
      'query ($after: String) { orderedPosts(first: 2, newest: true, after: $after) { edges { node { id } } } }',
      { after: down.data.orderedPosts.pageInfo.endCursor },
    );
    expect(ids(next.data.orderedPosts)).toEqual(['p-bob1', 'p-bob-draft']);
    const last = await query(
      '{ up: orderedPosts(last: 1) { edges { node { id } } } down: orderedPosts(last: 1, newest: true) { edges { node { id } } } }',
    );
    expect(ids(last.data.up)).toEqual(['p-hello']);
    expect(ids(last.data.down)).toEqual(['p-bob-draft']);
  });

  it('applies inside a related connection', async () => {
    const result = await query(
      '{ users { up: ordered(first: 5) { edges { node { id } } } down: ordered(first: 5, newest: true) { edges { node { id } } } } }',
    );
    expect(ids(result.data.users[0].up)).toEqual(['p-draft1', 'p-hello']);
    expect(ids(result.data.users[0].down)).toEqual(['p-hello', 'p-draft1']);
  });

  it('rejects an order outside the cursor order before SQL', async () => {
    const result = await query('{ wrongOrder(first: 1) { edges { node { id } } } }');
    expect(result.errors?.[0].message).toMatch(/cursor's columns in cursor order/);
    expect(result.statements).toHaveLength(0);
  });

  const mismatch = /^Invalid cursor: it was issued under a different ordering/;

  it("rejects a cursor from another request's ordering before SQL", async () => {
    const down = await query('{ orderedPosts(first: 1, newest: true) { pageInfo { endCursor } } }');
    const cursor = down.data.orderedPosts.pageInfo.endCursor;
    const up = await query(
      'query ($after: String) { orderedPosts(first: 1, after: $after) { edges { node { id } } } }',
      { after: cursor },
    );
    expect(up.errors?.map((error) => error.message)).toEqual([expect.stringMatching(mismatch)]);
    expect(up.statements).toHaveLength(0);
    // The same ordering still accepts it.
    const again = await query(
      'query ($after: String) { orderedPosts(first: 1, newest: true, after: $after) { edges { node { id } } } }',
      { after: cursor },
    );
    expect(ids(again.data.orderedPosts)).toEqual(['p-draft1']);
  });

  it("rejects a related connection cursor from another request's ordering", async () => {
    const first = await query(
      '{ users { down: ordered(first: 1, newest: true) { pageInfo { endCursor } } } }',
    );
    const cursor = first.data.users[0].down.pageInfo.endCursor;
    const next = await query(
      'query ($after: String) { users { down: ordered(first: 1, newest: true, after: $after) { edges { node { id } } } up: ordered(first: 1, after: $after) { edges { node { id } } } } }',
      { after: cursor },
    );
    expect(ids(next.data.users[0].down)).toEqual(['p-draft1']);
    expect(next.data.users[0].up).toBeNull();
    expect(next.errors?.[0].message).toMatch(mismatch);
    expect(next.errors?.map((error) => error.path)).toEqual([
      ['users', 0, 'up'],
      ['users', 1, 'up'],
    ]);
  });
});

describe('related connection errors', () => {
  function errorSchema() {
    const builder = createBuilder<{ allow?: boolean }>();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        posts: t.relatedConnection('posts', { cursor: 'id', nullable: true }),
        ordered: t.relatedConnection('posts', {
          cursor: ['title', 'id'],
          nullable: true,
          args: { byId: t.arg.boolean() },
          query: (args) => ({
            orderBy: (post) => (args.byId ? post.id.asc() : post.title.asc()),
          }),
        }),
        sized: t.relatedConnection('posts', {
          cursor: 'id',
          nullable: true,
          args: { boom: t.arg.boolean() },
          maxSize: (args) => {
            if (args.boom) {
              throw new Error('size callback failed');
            }
            return 5;
          },
        }),
        guarded: t.relatedConnection('posts', {
          cursor: 'id',
          nullable: true,
          totalCount: true,
          query: (_args, ctx) => {
            if (!ctx.allow) {
              throw new Error('not allowed');
            }
            return { where: { published: 1 } };
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  it.each([
    ['an undecodable cursor', 'posts(first: 1, after: "nope")', /Invalid cursor/],
    ['a negative page size', 'posts(first: -1)', /first/],
  ])('fails only the connection field, without planning it, for %s', async (_name, field, message) => {
    const result = await run(errorSchema(), `{ users { id c: ${field} { nodes { id } } } }`);
    expect(result.data.users).toEqual([
      { id: 'u-alice', c: null },
      { id: 'u-bob', c: null },
    ]);
    expect(result.errors?.map((error) => error.path)).toEqual([
      ['users', 0, 'c'],
      ['users', 1, 'c'],
    ]);
    expect(result.errors?.every((error) => message.test(error.message))).toBe(true);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).not.toMatch(/post/i);
  });

  it.each([
    ['an orderBy outside the cursor order', 'ordered(byId: true, first: 1)', /cursor order/],
    ['a throwing size callback', 'sized(boom: true, first: 1)', /size callback failed/],
    ['a throwing query callback', 'guarded(first: 1)', /not allowed/],
    ['a throwing query callback beneath totalCount', 'guarded', /not allowed/],
  ])('fails the statement for %s', async (_name, field, message) => {
    const selection = field === 'guarded' ? 'totalCount' : 'nodes { id }';
    const result = await run(errorSchema(), `{ users { id c: ${field} { ${selection} } } }`);
    expect(result.data.users).toBeNull();
    expect(result.errors?.map((error) => error.path)).toEqual([['users']]);
    expect(result.errors?.[0].message).toMatch(message);
    expect(result.statements).toHaveLength(0);
  });

  it('plans the same connections normally when their callbacks succeed', async () => {
    const result = await run(
      errorSchema(),
      '{ users { id a: ordered(first: 1) { nodes { id } } b: sized(first: 1) { nodes { id } } c: guarded { totalCount } } }',
      { context: { allow: true } },
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      id: 'u-alice',
      a: { nodes: [{ id: 'p-draft1' }] },
      b: { nodes: [{ id: 'p-draft1' }] },
      c: { totalCount: 1 },
    });
    expect(result.statements).toHaveLength(1);
  });
});

describe('related connection arguments', () => {
  function argsSchema() {
    const calls = { query: 0 };
    const builder = createBuilder();
    const Big = builder.scalarType(
      'Big' as never,
      {
        serialize: (value: bigint) => String(value),
        parseValue: (value: unknown) => BigInt(value as string),
      } as never,
    ) as never;
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        posts: t.relatedConnection('posts', {
          cursor: ['title', 'id'],
          nullable: true,
          args: { order: t.arg.stringList(), big: t.arg({ type: Big }) },
          query: (args) => {
            calls.query += 1;
            return {
              orderBy: (post) =>
                args.order?.[0] === 'desc' ? post.title.desc() : post.title.asc(),
            };
          },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return { schema: builder.toSchema(), calls };
  }

  it.each([
    ['no arguments', ''],
    ['a bigint argument', '(big: "5")'],
  ])('runs the query callback once per request and argument set for %s', async (_name, args) => {
    const { schema, calls } = argsSchema();
    const result = await run(schema, `{ users { id posts${args} { nodes { id } } } }`);
    expect(result.errors).toBeUndefined();
    expect(calls.query).toBe(1);
  });

  it('encodes each alias under the ordering its list argument chose', async () => {
    const { schema } = argsSchema();
    const first = await run(
      schema,
      '{ users { up: posts(order: ["asc"], first: 1) { pageInfo { endCursor } } down: posts(order: ["desc"], first: 1) { pageInfo { endCursor } } } }',
    );
    expect(first.errors).toBeUndefined();
    const { up, down } = first.data.users[0];
    const next = await run(
      schema,
      'query ($up: String, $down: String) { users { up: posts(order: ["asc"], first: 1, after: $up) { nodes { id } } down: posts(order: ["desc"], first: 1, after: $down) { nodes { id } } } }',
      { variables: { up: up.pageInfo.endCursor, down: down.pageInfo.endCursor } },
    );
    expect(next.errors).toBeUndefined();
    expect(next.data.users[0]).toEqual({
      up: { nodes: [{ id: 'p-hello' }] },
      down: { nodes: [{ id: 'p-draft1' }] },
    });
  });
});

describe('base collections', () => {
  const helper = () => prismaConnectionHelpers(createBuilder(), 'Post', { cursor: 'id' });

  type PageArgs = { first?: number; last?: number; after?: string; before?: string };
  interface Page {
    edges: { cursor: string; node: { id: string } }[];
    pageInfo: { startCursor: string | null; endCursor: string | null };
  }

  async function page(
    pages: { applyPagination(base: never, args: PageArgs, ctx: object): unknown },
    base: unknown,
    args: PageArgs,
  ): Promise<Page> {
    const applied = (await pages.applyPagination(base as never, args, {})) as {
      collection: { all(): PromiseLike<unknown> };
      wrap(rows: unknown): Page;
    };
    return applied.wrap(await applied.collection.all());
  }

  it.each([
    ['limit', () => db.orm.Post.limit(1), /unpaginated Collection/],
    ['offset', () => db.orm.Post.offset(1), /unpaginated Collection/],
    [
      'cursor',
      () => db.orm.Post.orderBy((p) => p.id.asc()).cursor({ id: 'p-hello' }),
      /unpaginated Collection/,
    ],
    ['distinct', () => db.orm.Post.distinct('title'), /distinct/],
  ])('rejects a base with %s before SQL', async (_name, base, message) => {
    const statements: CapturedExecution[] = [];
    await withCapture(statements, () =>
      expect(helper().applyPagination(base() as never, { first: 1 }, {})).rejects.toThrow(message),
    );
    expect(statements).toHaveLength(0);
  });

  it.each([
    [
      'an expression',
      () => db.orm.Post.orderBy(() => OrderByItem.asc(new ParamRef(BigInt(1)))),
      {
        first: 2,
      },
    ],
    ['another column', () => db.orm.Post.orderBy((p) => p.title.asc()), { first: 2 }],
    [
      'extra columns',
      () => db.orm.Post.orderBy([(p) => p.id.asc(), (p) => p.title.asc()]),
      {
        first: 2,
      },
    ],
    ['the opposite direction', () => db.orm.Post.orderBy((p) => p.id.desc()), { first: 2 }],
    [
      'the forward order on a backward page',
      () => db.orm.Post.orderBy((p) => p.id.asc()),
      {
        last: 2,
      },
    ],
  ])('rejects a base ordered by %s instead of silently reordering', async (_name, base, args) => {
    const statements: CapturedExecution[] = [];
    await withCapture(statements, () =>
      expect(helper().applyPagination(base() as never, args, {})).rejects.toThrow(
        /must match a prefix/,
      ),
    );
    expect(statements).toHaveLength(0);
  });

  it('pages a base ordered per direction for a descending cursor', async () => {
    const all = await query('{ newestFirst(first: 10) { edges { node { id } } } }');
    expect(all.errors).toBeUndefined();
    const order = ids(all.data.newestFirst);
    expect(order).toHaveLength(4);
    const first = await query(
      '{ newestFirst(first: 2) { pageInfo { endCursor } } last: newestFirst(last: 2) { edges { node { id } } } }',
    );
    expect(ids(first.data.last)).toEqual(order.slice(2));
    const next = await query(
      'query ($after: String) { newestFirst(first: 2, after: $after) { edges { cursor node { id } } } }',
      { after: first.data.newestFirst.pageInfo.endCursor },
    );
    expect(ids(next.data.newestFirst)).toEqual(order.slice(2));
    const before = await query(
      'query ($before: String) { newestFirst(before: $before) { edges { node { id } } } }',
      { before: next.data.newestFirst.edges[0].cursor },
    );
    expect(before.errors).toBeUndefined();
    expect(ids(before.data.newestFirst)).toEqual(order.slice(0, 2));
  });

  it('validates the base even when only totalCount is selected', async () => {
    const result = await query('{ preordered(first: 1) { totalCount } }');
    expect(result.errors?.[0].message).toMatch(/must match a prefix/);
    expect(result.statements).toHaveLength(0);
  });

  it('accepts a base whose order matches the cursor, forward and backward', async () => {
    const forward = await page(
      helper(),
      db.orm.Post.orderBy((p) => p.id.asc()),
      { first: 2 },
    );
    expect(ids(forward)).toEqual(['p-bob-draft', 'p-bob1']);
    const next = await page(
      helper(),
      db.orm.Post.orderBy((p) => p.id.asc()),
      {
        first: 2,
        after: forward.pageInfo.endCursor!,
      },
    );
    expect(ids(next)).toEqual(['p-draft1', 'p-hello']);
    const backward = await page(
      helper(),
      db.orm.Post.orderBy((p) => p.id.desc()),
      {
        last: 2,
        before: next.edges[1].cursor,
      },
    );
    expect(ids(backward)).toEqual(['p-bob1', 'p-draft1']);
  });

  it('extends a matching order prefix with the cursor tie-breaker', async () => {
    const pages = prismaConnectionHelpers(createBuilder(), 'Post', {
      cursor: [{ field: 'published', direction: 'desc' }, 'id'],
    });
    const result = await page(
      pages,
      db.orm.Post.orderBy((p) => p.published.desc()),
      { first: 4 },
    );
    expect(ids(result)).toEqual(['p-bob1', 'p-hello', 'p-bob-draft', 'p-draft1']);
  });

  it.each([
    [
      'descending',
      [{ field: 'id', direction: 'desc' }],
      ['p-hello', 'p-draft1', 'p-bob1', 'p-bob-draft'],
    ],
    [
      'mixed',
      [
        { field: 'published', direction: 'desc' },
        { field: 'id', direction: 'asc' },
      ],
      ['p-bob1', 'p-hello', 'p-bob-draft', 'p-draft1'],
    ],
  ] as const)('traverses every row and bounded range with %s ordering', async (_name, cursor, expected) => {
    const pages = prismaConnectionHelpers(createBuilder(), 'Post', { cursor });
    const read = (args: { first?: number; last?: number; after?: string; before?: string }) =>
      page(pages, db.orm.Post, args);
    const cursors: string[] = [];
    let after: string | undefined;
    for (const id of expected) {
      const result = await read({ first: 1, after });
      expect(ids(result)).toEqual([id]);
      after = result.pageInfo.endCursor!;
      cursors.push(after);
    }
    expect((await read({ first: 1, after })).edges).toEqual([]);
    const reverse: string[] = [];
    let before: string | undefined;
    for (let i = 0; i < expected.length; i += 1) {
      const result = await read({ last: 1, before });
      reverse.unshift(...ids(result));
      before = result.pageInfo.startCursor!;
    }
    expect(reverse).toEqual(expected);
    expect(ids(await read({ first: 4, after: cursors[0], before: cursors[3] }))).toEqual(
      expected.slice(1, 3),
    );
    expect(ids(await read({ first: 4, before: cursors[2] }))).toEqual(expected.slice(0, 2));
    expect(ids(await read({ last: 4, after: cursors[1] }))).toEqual(expected.slice(2));
  });
});

describe('prismaConnectionHelpers', () => {
  function helperSchema() {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        firstName: t.exposeString('firstName'),
        lastName: t.string({
          select: async () => ['lastName'],
          resolve: (user) => user.lastName,
        }),
        posts: t.relation('posts'),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    const search = prismaConnectionHelpers(builder, 'User', {
      cursor: 'id',
      args: (t) => ({ name: t.string() }),
      query: (args) => ({ where: args.name ? { firstName: args.name } : undefined }),
      totalCount: true,
    });
    const named = prismaConnectionHelpers(builder, 'User', {
      cursor: 'id',
      totalCount: () => 7,
      resolveNode: (user) => ({ user, decoratedAt: 'decorated' }),
    });
    const Decorated = builder
      .objectRef<{ user: { id: string; firstName: string }; decoratedAt: string }>('Decorated')
      .implement({
        fields: (t) => ({
          userId: t.string({ resolve: (node) => node.user.id }),
          firstName: t.string({ resolve: (node) => node.user.firstName }),
          decoratedAt: t.exposeString('decoratedAt'),
        }),
      });
    builder.queryType({
      fields: (t) => ({
        search: t.connection(
          {
            type: search.ref,
            args: search.getArgs(),
            resolve: async (_root, args, context, info) => {
              const { collection, totalCountPromise, wrap } = await search.applyPagination(
                db.orm.User,
                args,
                context,
                info,
              );
              const [rows, total] = await Promise.all([collection.all(), totalCountPromise]);
              return wrap(rows, total);
            },
          },
          search.connectionOptions({}),
        ),
        decorated: t.connection(
          {
            type: Decorated,
            args: named.getArgs(),
            resolve: async (_root, args, context) => {
              const { collection, totalCountPromise, wrap } = await named.applyPagination(
                db.orm.User,
                args,
                context,
              );
              return wrap(await collection.all(), await totalCountPromise);
            },
          },
          named.connectionOptions({}),
        ),
      }),
    });
    return builder.toSchema();
  }

  it('filters rows and count with where and args, and plans the node selection', async () => {
    const result = await run(
      helperSchema(),
      '{ search(first: 5, name: "Bob") { totalCount edges { node { firstName lastName posts { title } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.search).toEqual({
      totalCount: 1,
      edges: [
        {
          node: {
            firstName: 'Bob',
            lastName: 'Brown',
            posts: [{ title: 'Bob writes' }, { title: 'Bob draft' }],
          },
        },
      ],
    });
    expect(result.statements.filter(({ sql }) => !/count\(/i.test(sql))).toHaveLength(1);
  });

  it('transforms nodes with resolveNode while cursors still encode the original rows', async () => {
    const first = await run(
      helperSchema(),
      '{ decorated(first: 1) { totalCount pageInfo { endCursor } edges { node { userId firstName decoratedAt } } } }',
    );
    expect(first.data.decorated).toMatchObject({
      totalCount: 7,
      edges: [{ node: { userId: 'u-alice', firstName: 'Alice', decoratedAt: 'decorated' } }],
    });
    const second = await run(
      helperSchema(),
      'query ($after: String) { decorated(first: 1, after: $after) { edges { node { userId } } } }',
      { variables: { after: first.data.decorated.pageInfo.endCursor } },
    );
    expect(second.data.decorated.edges).toEqual([{ node: { userId: 'u-bob' } }]);
  });

  it('leaves nodes untouched when resolveNode is absent', async () => {
    const off = false as boolean;
    const pages = prismaConnectionHelpers(createBuilder(), 'User', {
      cursor: 'id',
      resolveNode: off ? (user) => ({ user }) : undefined,
    });
    const result = await pages.applyPagination(db.orm.User, { first: 1 }, {});
    expect(result.wrap(await result.collection.all()).edges[0].node).toMatchObject({
      id: 'u-alice',
    });
  });

  it('starts a count only when it is read, and caches it', async () => {
    const count = vi.fn(async () => 17);
    const pages = prismaConnectionHelpers(createBuilder(), 'User', {
      cursor: 'id',
      totalCount: count,
    });
    const result = await pages.applyPagination(db.orm.User, {}, {});
    await Promise.resolve();
    expect(count).not.toHaveBeenCalled();
    const promise = result.totalCountPromise;
    expect(result.totalCountPromise).toBe(promise);
    expect(await promise).toBe(17);
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('does not count when the query does not select totalCount', async () => {
    const count = vi.fn(async () => 17);
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    const pages = prismaConnectionHelpers(builder, 'User', { cursor: 'id', totalCount: count });
    builder.queryType({
      fields: (t) => ({
        users: t.connection(
          {
            type: pages.ref,
            resolve: async (_root, args, context, info) => {
              const result = await pages.applyPagination(db.orm.User, args, context, info);
              return result.wrap(await result.collection.all(), await result.totalCountPromise);
            },
          },
          pages.connectionOptions({}),
        ),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { edges { node { id } } } }');
    expect(result.errors).toBeUndefined();
    expect(count).not.toHaveBeenCalled();
  });

  it('pages a named type when given its ref instead of the model name', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    const Card = builder.prismaObject('User', {
      variant: 'UserCard',
      fields: (t) => ({ name: t.exposeString('firstName') }),
    });
    const pages = prismaConnectionHelpers(builder, Card, { cursor: 'id' });
    expect(pages.ref).toBe(Card);
    builder.queryType({
      fields: (t) => ({
        cards: t.connection({
          type: pages.ref,
          resolve: async (_root, args, context, info) => {
            const result = await pages.applyPagination(db.orm.User, args, context, info);
            return result.wrap(await result.collection.all());
          },
        }),
      }),
    });
    const first = await run(
      builder.toSchema(),
      '{ cards(first: 1) { pageInfo { endCursor } edges { node { __typename name } } } }',
    );
    expect(first.errors).toBeUndefined();
    expect(first.data.cards.edges).toEqual([{ node: { __typename: 'UserCard', name: 'Alice' } }]);
    const second = await run(
      builder.toSchema(),
      'query ($after: String) { cards(first: 1, after: $after) { edges { node { name } } } }',
      { variables: { after: first.data.cards.pageInfo.endCursor } },
    );
    expect(second.data.cards.edges).toEqual([{ node: { name: 'Bob' } }]);
  });
});

it('pages the example schema connection with its nodes planned', async () => {
  const result = await run(
    buildExampleSchema(db),
    '{ usersConnection(first: 1) { edges { node { firstName postCount } } } }',
  );
  expect(result.data.usersConnection.edges).toEqual([
    { node: { firstName: 'Alice', postCount: 2 } },
  ]);
  expect(result.statements.filter(({ sql }) => !/^SELECT count/i.test(sql))).toHaveLength(1);
});
