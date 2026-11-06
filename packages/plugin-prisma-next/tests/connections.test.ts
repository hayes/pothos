import { describe, expect, it } from 'vitest';
import { prismaConnectionHelpers } from '../src';
import { detailOf } from './fixtures/errors';
import {
  type CapturedExecution,
  createBuilder,
  deferSchema,
  run,
  runIncremental,
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
      posts: t.relatedConnection('posts', { totalCount: true }),
      postsAlt: t.relatedConnection('posts', { totalCount: true }),
      published: t.relatedConnection('posts', {
        totalCount: true,
        query: { where: { published: 1 } },
      }),
      callableCount: t.relatedConnection('posts', { totalCount: () => 23 }),
      wrapped: t.relatedConnection('posts', {
        totalCount: true,
        errors: { types: [] },
      }),
      sized: t.relatedConnection('posts', { defaultSize: 1, maxSize: 1 }),
      ordered: t.relatedConnection('posts', {
        args: { newest: t.arg.boolean() },
        query: (args) => ({ orderBy: { title: args.newest ? 'desc' : 'asc' } }),
      }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
      userPage: t.prismaConnection({
        type: 'User',
        totalCount: true,
        errors: { types: [] },
        resolve: () => db.orm.User,
      }),
      posts: t.prismaConnection({
        type: 'Post',
        totalCount: true,
        resolve: () => db.orm.Post,
      }),
      postsByDate: t.prismaConnection({
        type: 'Post',
        query: { orderBy: { createdAt: 'asc' } },
        resolve: () => db.orm.Post,
      }),
      sizedPosts: t.prismaConnection({
        type: 'Post',
        defaultSize: 1,
        maxSize: 2,
        resolve: () => db.orm.Post,
      }),
      orderedPosts: t.prismaConnection({
        type: 'Post',
        args: { newest: t.arg.boolean() },
        query: (args) => ({ orderBy: { title: args.newest ? 'desc' : 'asc' } }),
        resolve: () => db.orm.Post,
      }),
      sortedPosts: t.prismaConnection({
        type: 'Post',
        args: { sort: t.arg.string({ required: true }) },
        query: (args) => ({ orderBy: { [args.sort]: 'desc' } }),
        resolve: () => db.orm.Post,
      }),
      newestFirst: t.prismaConnection({
        type: 'Post',
        query: { orderBy: { createdAt: 'desc', id: 'asc' } },
        resolve: () => db.orm.Post,
      }),
      callableCount: t.prismaConnection({
        type: 'Post',
        totalCount: () => 42,
        resolve: () => db.orm.Post,
      }),
      countRejects: t.prismaConnection({
        type: 'Post',
        totalCount: failing('count-failed'),
        resolve: () => db.orm.Post,
      }),
      rowsReject: t.prismaConnection({
        type: 'Post',
        totalCount: () => 9,
        resolve: failing('rows-failed') as never,
      }),
      countThrows: t.prismaConnection({
        type: 'Post',
        totalCount: (() => {
          throw new Error('sync-throw');
        }) as never,
        resolve: () => db.orm.Post,
      }),
      nullable: t.prismaConnection({
        type: 'Post',
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

  it('orders by a computed column, and fails the field for one that is not orderable', async () => {
    const result = await query(
      '{ a: sortedPosts(sort: "title", first: 1) { nodes { id } } b: sortedPosts(sort: "nope") { nodes { id } } }',
    );
    expect(result.data).toEqual({ a: { nodes: [{ id: 'p-hello' }] }, b: null });
    expect(result.errors?.map((error) => [error.path, detailOf(error)])).toEqual([
      [['b'], "orderBy can't order by 'Post.nope' is not a field of the model."],
    ]);
  });

  it("rejects a cursor from another request's ordering or columns before SQL", async () => {
    const down = await query('{ orderedPosts(first: 1, newest: true) { pageInfo { endCursor } } }');
    const cursor = down.data.orderedPosts.pageInfo.endCursor;
    const up = await query(
      'query ($after: String) { orderedPosts(first: 1, after: $after) { edges { node { id } } } }',
      { after: cursor },
    );
    expect(up.errors?.map((error) => error.message)).toEqual(['Invalid cursor.']);
    expect(up.statements).toHaveLength(0);
    // The same ordering still accepts it.
    const again = await query(
      'query ($after: String) { orderedPosts(first: 1, newest: true, after: $after) { edges { node { id } } } }',
      { after: cursor },
    );
    expect(ids(again.data.orderedPosts)).toEqual(['p-draft1']);
    const byId = await query('{ posts(first: 1) { pageInfo { endCursor } } }');
    const other = await query(
      'query ($after: String) { orderedPosts(first: 1, after: $after) { edges { node { id } } } }',
      { after: byId.data.posts.pageInfo.endCursor },
    );
    expect(other.errors?.map((error) => error.message)).toEqual(['Invalid cursor.']);
    expect(other.statements).toHaveLength(0);
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
    expect(next.data.users).toBeNull();
    expect(next.errors?.map((error) => [error.path, error.message])).toEqual([
      [['users'], 'Invalid cursor.'],
    ]);
  });

  it("rejects a cursor from another model's connection before SQL", async () => {
    const posts = await query('{ posts(first: 1) { pageInfo { endCursor } } }');
    const users = await query(
      'query ($after: String) { userPage(first: 1, after: $after) { edges { node { id } } } }',
      { after: posts.data.posts.pageInfo.endCursor },
    );
    expect(users.data.userPage).toBeNull();
    expect(users.errors?.map((error) => error.message)).toEqual(['Invalid cursor.']);
    expect(users.statements).toHaveLength(0);
  });
});

describe('related connection errors', () => {
  function errorSchema() {
    const builder = createBuilder<{ allow?: boolean }>();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        posts: t.relatedConnection('posts', { nullable: true }),
        ordered: t.relatedConnection('posts', {
          nullable: true,
          args: { sort: t.arg.string() },
          query: (args) => ({ orderBy: { [args.sort ?? 'title']: 'asc' } }),
        }),
        sometimesOrdered: t.relatedConnection('posts', {
          nullable: true,
          args: { newest: t.arg.boolean() },
          query: (args) => ({ orderBy: args.newest ? { title: 'desc' } : undefined }),
        }),
        sized: t.relatedConnection('posts', {
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
    ['a throwing size callback', 'sized(boom: true, first: 1)', /size callback failed/],
    // The developer's error, which the client sees only as `Unexpected error.`.
    ['a column that is not orderable', 'ordered(sort: "nope", first: 1)', /^Unexpected error\.$/],
    ['a throwing query callback', 'guarded(first: 1)', /not allowed/],
    ['a throwing query callback beneath totalCount', 'guarded', /not allowed/],
  ])('fails the root field, without querying, for %s', async (_name, field, message) => {
    const selection = field === 'guarded' ? 'totalCount' : 'nodes { id }';
    const result = await run(errorSchema(), `{ users { id c: ${field} { ${selection} } } }`);
    expect(result.data.users).toBeNull();
    expect(result.errors?.map((error) => error.path)).toEqual([['users']]);
    expect(result.errors?.every((error) => message.test(error.message))).toBe(true);
    expect(result.statements).toHaveLength(0);
  });

  it('fails the root field for a cursor from columns the orderBy callback dropped', async () => {
    const first = await run(
      errorSchema(),
      '{ users { c: sometimesOrdered(first: 1, newest: true) { pageInfo { endCursor } } } }',
    );
    const after = first.data.users[0].c.pageInfo.endCursor;
    const result = await run(
      errorSchema(),
      'query ($after: String) { users { id posts(first: 1) { nodes { id } } c: sometimesOrdered(first: 1, after: $after) { nodes { id } } } }',
      { variables: { after } },
    );
    expect(result.data.users).toBeNull();
    expect(result.errors?.map((error) => [error.path, error.message])).toEqual([
      [['users'], 'Invalid cursor.'],
    ]);
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
    const calls = { order: 0 };
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
          nullable: true,
          args: { order: t.arg.stringList(), big: t.arg({ type: Big }) },
          query: (args) => {
            calls.order += 1;
            return { orderBy: { title: args.order?.[0] === 'desc' ? 'desc' : 'asc' } };
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
  ])('runs the orderBy callback once per request and argument set for %s', async (_name, args) => {
    const { schema, calls } = argsSchema();
    const result = await run(schema, `{ users { id posts${args} { nodes { id } } } }`);
    expect(result.errors).toBeUndefined();
    expect(calls.order).toBe(1);
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

// Each user's first post with the default order, title descending, and with `order: "asc"`.
const titleDesc = ['p-hello', 'p-bob1'];
const titleAsc = ['p-draft1', 'p-bob-draft'];
const firstIds = (users: { posts: { nodes: { id: string }[] } }[]) =>
  users.map((user) => user.posts.nodes[0]!.id);

describe('related connection state', () => {
  class Stamp {
    constructor(readonly value: string) {}
  }

  function stateSchema() {
    const calls = { sizes: 0 };
    const builder = createBuilder();
    const At = builder.scalarType(
      'At' as never,
      {
        serialize: (value: Stamp) => value.value,
        parseValue: (value: unknown) => new Stamp(value as string),
      } as never,
    ) as never;
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        posts: t.relatedConnection('posts', {
          nullable: true,
          args: { at: t.arg({ type: At }), order: t.arg.string() },
          defaultSize: () => {
            calls.sizes += 1;
            return 1;
          },
          query: (args) => ({
            orderBy:
              args.order === 'date'
                ? { createdAt: 'desc' }
                : { title: args.order === 'asc' ? 'asc' : 'desc' },
          }),
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
    return { schema: builder.toSchema(), deferring: deferSchema(builder), calls };
  }

  it('keeps the ordering and page sizes for an argument it cannot serialize', async () => {
    const { schema, calls } = stateSchema();
    const result = await run(
      schema,
      '{ users { posts(at: "now", first: 1) { pageInfo { endCursor } nodes { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(calls.sizes).toBe(1);
    expect(firstIds(result.data.users)).toEqual(titleDesc);
  });

  it('encodes under the ordering of aliases that share one load', async () => {
    const { schema } = stateSchema();
    const result = await run(
      schema,
      '{ users { a: posts(first: 1) { pageInfo { endCursor } nodes { id } } b: posts(first: 1) { pageInfo { endCursor } nodes { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.statements).toHaveLength(1);
    const [alice] = result.data.users;
    expect(alice.a).toEqual(alice.b);
    expect(alice.a.nodes).toEqual([{ id: 'p-hello' }]);
  });

  it('keeps aliases apart whose orderBy callback chose different orders for the same arguments', async () => {
    let calls = 0;
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relatedConnection('posts', {
          query: () => {
            calls += 1;
            return { orderBy: { title: calls % 2 ? 'asc' : 'desc' } };
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
    const result = await run(
      builder.toSchema(),
      '{ users { a: posts(first: 1) { nodes { id } } b: posts(first: 1) { nodes { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      a: { nodes: [{ id: 'p-draft1' }] },
      b: { nodes: [{ id: 'p-hello' }] },
    });
  });

  it('keeps aliases with different arguments apart', async () => {
    const { schema } = stateSchema();
    const result = await run(
      schema,
      '{ users { up: posts(order: "asc") { nodes { id } } down: posts { nodes { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    const [alice] = result.data.users;
    expect(alice.up.nodes).toEqual([{ id: 'p-draft1' }]);
    expect(alice.down.nodes).toEqual([{ id: 'p-hello' }]);
  });

  it('keeps the same field apart in different parts of a query', async () => {
    const { schema } = stateSchema();
    const result = await run(
      schema,
      `{
        up: users { posts(order: "asc") { nodes { id } } }
        down: users { posts { nodes { id } } }
      }`,
    );
    expect(result.errors).toBeUndefined();
    expect(firstIds(result.data.up)).toEqual(titleAsc);
    expect(firstIds(result.data.down)).toEqual(titleDesc);
  });

  it('merges a field selected in a fragment', async () => {
    const { schema } = stateSchema();
    const result = await run(
      schema,
      `{ users { posts(first: 1) { nodes { id } } ...More } }
      fragment More on User { posts(first: 1) { pageInfo { endCursor } } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.statements).toHaveLength(1);
    expect(firstIds(result.data.users)).toEqual(titleDesc);
    expect(result.data.users[0].posts.pageInfo.endCursor).toEqual(expect.any(String));
  });

  describe('when the parent reloads for a deferred field', () => {
    const deferred = (args: string, selection: string) =>
      `{ users { id ... @defer { posts(${args}) { ${selection} } } } }`;

    it('encodes under the ordering the reload paged with and runs size callbacks once', async () => {
      const { deferring, calls } = stateSchema();
      const result = await runIncremental(
        deferring,
        deferred('first: 1', 'pageInfo { endCursor } nodes { id }'),
      );
      expect(result.patchErrors).toEqual([]);
      expect(result.initialStatements).toBe(1);
      expect(result.patches).toHaveLength(2);
      expect(firstIds(result.patches as never).sort()).toEqual([...titleDesc].sort());
      expect(calls.sizes).toBe(1);
    });

    it('checks a cursor against the ordering the reload paged with', async () => {
      const { schema, deferring } = stateSchema();
      const first = await run(
        schema,
        '{ users { posts(order: "date", first: 1) { pageInfo { endCursor } } } }',
      );
      const after = first.data.users[0].posts.pageInfo.endCursor;
      const result = await runIncremental(
        deferring,
        deferred(`first: 1, after: "${after}"`, 'nodes { id }'),
      );
      expect(result.patches).toEqual([{ posts: null }, { posts: null }]);
      expect(result.patchErrors).toHaveLength(2);
      expect(String(result.patchErrors[0])).toMatch(/Invalid cursor\./);
    });

    it('fails only the field for a bad cursor', async () => {
      const { deferring } = stateSchema();
      const result = await runIncremental(deferring, deferred('after: "nope"', 'nodes { id }'));
      expect(result.patches).toEqual([{ posts: null }, { posts: null }]);
      expect(result.patchErrors).toHaveLength(2);
      expect(String(result.patchErrors[0])).toMatch(/Invalid cursor/);
    });
  });

  it('counts a totalCount under @defer', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relatedConnection('posts', { totalCount: true }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        posts: t.prismaConnection({
          type: 'Post',
          totalCount: true,
          resolve: () => db.orm.Post,
        }),
      }),
    });
    const result = await runIncremental(
      deferSchema(builder),
      `{
        users { posts(first: 1) { nodes { id } ... @defer { totalCount } } }
        posts(first: 1) { ... @defer { totalCount } }
      }`,
    );
    expect(result.initial.errors).toBeUndefined();
    expect(result.patchErrors).toEqual([]);
    expect(result.initial.data).toMatchObject({
      users: [{ posts: { nodes: [{ id: 'p-draft1' }] } }, expect.anything()],
    });
    expect(result.patches).toEqual(
      expect.arrayContaining([{ totalCount: 2 }, { totalCount: 2 }, { totalCount: 4 }]),
    );
  });

  it('keeps state for a field an implementation inherits from an interface', async () => {
    const calls = { sizes: 0 };
    const builder = createBuilder();
    const WithPosts = builder.prismaInterface('User', {
      variant: 'WithPosts',
      resolveType: () => 'User',
      fields: (t) => ({
        posts: t.relatedConnection('posts', {
          nullable: true,
          defaultSize: () => {
            calls.sizes += 1;
            return 1;
          },
          query: () => ({ orderBy: { title: 'desc' } }),
        }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const User = builder.prismaObject('User', {
      interfaces: [WithPosts],
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        withPosts: t.prismaField({
          type: [WithPosts],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const schema = builder.toSchema();
    const selections = [
      '{ users { posts(first: 1) { nodes { id } } } }',
      '{ users: withPosts { posts(first: 1) { nodes { id } } } }',
    ];
    for (const selection of selections) {
      calls.sizes = 0;
      const result = await run(schema, selection);
      expect(result.errors).toBeUndefined();
      expect(result.statements).toHaveLength(1);
      expect(firstIds(result.data.users)).toEqual(titleDesc);
      expect(calls.sizes).toBe(1);
    }
    const bad = await run(schema, '{ withPosts { posts(after: "nope") { nodes { id } } } }');
    expect(bad.data.withPosts).toBeNull();
    expect(bad.errors?.every((error) => /Invalid cursor/.test(error.message))).toBe(true);
  });
});

describe('connection objects', () => {
  it("carry the field's parent and arguments", async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const pageFields = {
      fields: (
        c: PothosSchemaTypes.ObjectFieldBuilder<
          PothosSchemaTypes.ExtendDefaultTypes<{}>,
          { parent?: { id: string }; args: { first?: number | null } }
        >,
      ) => ({
        owner: c.string({ nullable: true, resolve: (page) => page.parent?.id ?? 'root' }),
        asked: c.int({ nullable: true, resolve: (page) => page.args.first }),
      }),
    };
    builder.prismaObject('User', {
      fields: (t) => ({ posts: t.relatedConnection('posts', {}, pageFields as never) }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        posts: t.prismaConnection(
          { type: 'Post', resolve: () => db.orm.Post },
          pageFields as never,
        ),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ posts(first: 1) { owner asked } users { posts(first: 2) { owner asked } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      posts: { owner: 'root', asked: 1 },
      users: [{ posts: { owner: 'u-alice', asked: 2 } }, { posts: { owner: 'u-bob', asked: 2 } }],
    });
  });
});

describe('connection aggregates', () => {
  // biome-ignore lint/suspicious/noExplicitAny: a page's shape isn't what these tests check
  const pageLength = (t: any) => ({
    totalCount: t.int({ resolve: (page: { edges: unknown[] }) => page.edges.length }),
  });

  function aggregateSchema() {
    const builder = createBuilder();
    const Post = builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const Prebuilt = builder.connectionObject(
      { type: Post, name: 'PrebuiltPosts', fields: pageLength },
      { name: 'PrebuiltPostsEdge' },
    );
    builder.prismaObject('User', {
      fields: (t) => ({
        own: t.relatedConnection('posts', {}, { fields: pageLength }),
        prebuilt: t.relatedConnection('posts', {}, Prebuilt as never),
        counted: t.relatedConnection('posts', { totalCount: true }),
      }),
    });
    const posts = { type: 'Post', resolve: () => db.orm.Post } as const;
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        own: t.prismaConnection(posts, { fields: pageLength }),
        prebuilt: t.prismaConnection(posts, Prebuilt as never),
        counted: t.prismaConnection({ ...posts, totalCount: true }),
      }),
    });
    return builder.toSchema();
  }

  it.each([
    'own',
    'prebuilt',
  ])('loads the page for a user-defined totalCount without the option on t.prismaConnection (%s)', async (field) => {
    const result = await run(aggregateSchema(), `{ ${field}(first: 2) { totalCount } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data[field].totalCount).toBe(2);
    expect(result.statements[0].sql).not.toMatch(/count\(/i);
  });

  it.each([
    'own',
    'prebuilt',
  ])('loads the page for a user-defined totalCount without the option on t.relatedConnection (%s)', async (field) => {
    const result = await run(aggregateSchema(), `{ users { ${field} { totalCount } } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0][field].totalCount).toBe(2);
    expect(result.statements[0].sql).not.toMatch(/count\(/i);
  });

  it('counts for a prebuilt connection made with the helpers connectionOptions', async () => {
    const builder = createBuilder();
    const Post = builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const pages = prismaConnectionHelpers(builder, 'Post', { totalCount: true });
    const Prebuilt = builder.connectionObject(
      pages.connectionOptions({ type: Post, name: 'CountedPosts' }),
      { name: 'CountedPostsEdge' },
    );
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaConnection(
          { type: 'Post', totalCount: true, resolve: () => db.orm.Post },
          Prebuilt as never,
        ),
      }),
    });
    const result = await run(builder.toSchema(), '{ posts(first: 1) { totalCount } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.posts.totalCount).toBe(4);
    expect(result.statements[0].sql).not.toMatch(/limit/i);
  });

  it('sees the generated count through a direct errors result', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaConnection({
          type: 'Post',
          totalCount: true,
          errors: { types: [], directResult: true },
          resolve: () => db.orm.Post,
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ posts(first: 1) { ... on QueryPostsConnection { totalCount } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts.totalCount).toBe(4);
    expect(result.statements[0].sql).not.toMatch(/limit/i);
  });

  it('skips rows for the generated count, __typename and an alias on t.prismaConnection', async () => {
    const result = await run(
      aggregateSchema(),
      '{ counted(first: 2) { n: totalCount totalCount __typename } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.counted).toMatchObject({ n: 4, totalCount: 4 });
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).not.toMatch(/limit/i);
  });

  it('skips rows for the generated count, __typename and an alias on t.relatedConnection', async () => {
    const result = await run(
      aggregateSchema(),
      '{ users { counted { n: totalCount __typename } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0].counted).toMatchObject({ n: 2 });
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).toMatch(/count\(/i);
    expect(result.statements[0].sql).not.toMatch(/limit/i);
  });
});

describe('a user-defined totalCount with the totalCount option', () => {
  // biome-ignore lint/suspicious/noExplicitAny: shared by connections of different parents
  const readCount = (t: any) => ({
    totalCount: t.int({
      nullable: true,
      resolve: (page: { totalCount?: number }) => page.totalCount,
    }),
  });

  function userCountSchema() {
    const builder = createBuilder();
    const Post = builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const Prebuilt = builder.connectionObject(
      { type: Post, name: 'UserCountPosts', fields: readCount },
      { name: 'UserCountPostsEdge' },
    );
    builder.prismaObject('User', {
      fields: (t) => ({
        prebuilt: t.relatedConnection('posts', { totalCount: true }, Prebuilt as never),
        override: t.relatedConnection(
          'posts',
          { totalCount: true },
          {
            fields: (c) => ({
              totalCount: c.int({ nullable: true, resolve: (page) => page.totalCount }),
            }),
          },
        ),
        callback: t.relatedConnection('posts', { totalCount: () => 99 }, { fields: readCount }),
        // Reads the page, which the count leaves empty.
        pageLength: t.relatedConnection(
          'posts',
          { totalCount: true },
          {
            fields: (c) => ({
              totalCount: c.int({ resolve: (page) => (page.edges as unknown[]).length }),
            }),
          },
        ),
      }),
    });
    const posts = { type: 'Post', totalCount: true, resolve: () => db.orm.Post } as const;
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        prebuilt: t.prismaConnection(posts, Prebuilt as never),
        override: t.prismaConnection(posts, {
          fields: (c) => ({
            totalCount: c.int({ nullable: true, resolve: (page) => page.totalCount }),
          }),
        }),
        callback: t.prismaConnection({ ...posts, totalCount: () => 99 }, { fields: readCount }),
      }),
    });
    return builder.toSchema();
  }

  it.each([
    ['prebuilt', 4, 1],
    ['override', 4, 1],
    ['callback', 99, 0],
  ])('reads the count without loading rows on t.prismaConnection (%s)', async (field, total, statements) => {
    const result = await run(userCountSchema(), `{ ${field}(first: 1) { totalCount } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data[field].totalCount).toBe(total);
    expect(result.statements).toHaveLength(statements);
    expect(result.statements.filter(({ sql }) => /limit/i.test(sql))).toHaveLength(0);
  });

  it.each([
    ['prebuilt', 2],
    ['override', 2],
    ['callback', 99],
  ])('reads the count without loading rows on t.relatedConnection (%s)', async (field, total) => {
    const result = await run(userCountSchema(), `{ users { ${field} { totalCount } } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0][field].totalCount).toBe(total);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).not.toMatch(/limit/i);
  });

  it('gives a totalCount that reads the page an empty one', async () => {
    const result = await run(userCountSchema(), '{ users { pageLength { totalCount } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0].pageLength.totalCount).toBe(0);
  });

  it("counts for an override in the helpers' connectionOptions", async () => {
    const builder = createBuilder();
    const Post = builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const pages = prismaConnectionHelpers(builder, 'Post', { totalCount: true });
    builder.queryType({
      fields: (t) => ({
        posts: t.connection(
          {
            type: Post,
            resolve: async (_parent, args, ctx, info) => {
              const { collection, totalCountPromise, wrap } = await pages.applyPagination(
                db.orm.Post,
                args,
                ctx,
                info,
              );
              return wrap(await collection.all(), await totalCountPromise);
            },
          },
          pages.connectionOptions({ fields: readCount }),
        ),
      }),
    });
    const result = await run(builder.toSchema(), '{ posts(first: 1) { totalCount } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.posts.totalCount).toBe(4);
  });

  describe('from globalConnectionField', () => {
    function globalCountSchema() {
      const builder = createBuilder();
      builder.globalConnectionField('totalCount', (t) =>
        t.int({
          nullable: true,
          resolve: (page) => {
            const { totalCount, edges } = page as unknown as {
              totalCount?: number;
              edges: unknown[];
            };
            return totalCount ?? edges.length;
          },
        }),
      );
      const Post = builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      const Prebuilt = builder.connectionObject(
        { type: Post, name: 'GlobalCountPosts' },
        { name: 'GlobalCountPostsEdge' },
      );
      builder.prismaObject('User', {
        fields: (t) => ({
          counted: t.relatedConnection('posts', { totalCount: true }),
          prebuilt: t.relatedConnection('posts', { totalCount: true }, Prebuilt as never),
        }),
      });
      const posts = { type: 'Post', resolve: () => db.orm.Post } as const;
      builder.queryType({
        fields: (t) => ({
          users: t.prismaField({
            type: ['User'],
            resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
          }),
          counted: t.prismaConnection({ ...posts, totalCount: true }),
          prebuilt: t.prismaConnection({ ...posts, totalCount: true }, Prebuilt as never),
        }),
      });
      return builder.toSchema();
    }

    // With the option set, the generated field and a prebuilt connection's global one are the
    // count, so neither loads rows.
    it.each([
      ['counted', 1],
      ['prebuilt', 1],
    ])('reads the count with the option on t.prismaConnection (%s)', async (field, statements) => {
      const result = await run(globalCountSchema(), `{ ${field}(first: 1) { totalCount } }`);
      expect(result.errors).toBeUndefined();
      expect(result.data[field].totalCount).toBe(4);
      expect(result.statements).toHaveLength(statements);
    });

    it.each([
      'counted',
      'prebuilt',
    ])('reads the count with the option on t.relatedConnection (%s)', async (field) => {
      const result = await run(
        globalCountSchema(),
        `{ users { ${field}(first: 1) { totalCount } } }`,
      );
      expect(result.errors).toBeUndefined();
      expect(result.data.users[0][field].totalCount).toBe(2);
    });
  });
});

describe('base collections', () => {
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

  it('pages a descending order in both directions', async () => {
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

  it.each([
    ['descending', { id: 'desc' }, ['p-hello', 'p-draft1', 'p-bob1', 'p-bob-draft']],
    ['mixed', { published: 'desc', id: 'asc' }, ['p-bob1', 'p-hello', 'p-bob-draft', 'p-draft1']],
  ] as const)('traverses every row and bounded range with %s ordering', async (_name, orderBy, expected) => {
    const pages = prismaConnectionHelpers(createBuilder(), 'Post', {
      query: { orderBy: orderBy as Record<string, 'asc' | 'desc'> },
    });
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
          select: async () => ({ lastName: true }),
          resolve: (user) => user.lastName,
        }),
        posts: t.relation('posts'),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ title: t.exposeString('title') }) });
    const search = prismaConnectionHelpers(builder, 'User', {
      args: (t) => ({ name: t.string() }),
      query: (args) => ({ where: args.name ? { firstName: args.name } : undefined }),
      totalCount: true,
    });
    const named = prismaConnectionHelpers(builder, 'User', {
      totalCount: true,
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
      totalCount: 2,
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
      resolveNode: off ? (user) => ({ user }) : undefined,
    });
    const result = await pages.applyPagination(db.orm.User, { first: 1 }, {});
    expect(result.wrap(await result.collection.all()).edges[0].node).toMatchObject({
      id: 'u-alice',
    });
  });

  it('starts a count only when it is read, and runs it once', async () => {
    const statements: CapturedExecution[] = [];
    const counts = () => statements.filter(({ sql }) => /count\(/i.test(sql)).length;
    await withCapture(statements, async () => {
      const pages = prismaConnectionHelpers(createBuilder(), 'User', { totalCount: true });
      const result = await pages.applyPagination(db.orm.User, {}, {});
      await Promise.resolve();
      expect(counts()).toBe(0);
      expect(await result.totalCountPromise).toBe(2);
      expect(await result.totalCountPromise).toBe(2);
      expect(counts()).toBe(1);
    });
  });

  it('does not count when the query does not select totalCount', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    const pages = prismaConnectionHelpers(builder, 'User', { totalCount: true });
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
    expect(result.statements.map(({ sql }) => sql).join()).not.toMatch(/count\(/i);
  });

  it('fails totalCount when wrap is not given a count', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    const pages = prismaConnectionHelpers(builder, 'User', { totalCount: true });
    builder.queryType({
      fields: (t) => ({
        users: t.connection(
          {
            type: pages.ref,
            nullable: true,
            resolve: async (_root, args, context, info) => {
              const result = await pages.applyPagination(db.orm.User, args, context, info);
              return result.wrap(await result.collection.all());
            },
          },
          pages.connectionOptions({}),
        ),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { totalCount } }');
    expect(result.data.users).toBeNull();
    expect(result.errors?.map((error) => error.message)).toEqual([
      expect.stringContaining('Cannot return null for non-nullable field'),
    ]);
  });

  // Post.comments → Comment.author: the page follows the comments, while each node is a user.
  function commentersSchema({
    calls = { query: 0 },
    resolveRows = (rows: readonly object[], _post: object) => rows,
  } = {}) {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        firstName: t.exposeString('firstName'),
        posts: t.relation('posts'),
      }),
    });
    const commenters = prismaConnectionHelpers(builder, 'Comment', {
      query: () => {
        calls.query += 1;
        return { orderBy: { createdAt: 'desc' } };
      },
      totalCount: true,
      select: (nodeSelection) => ({ body: true, author: nodeSelection() }),
      resolveNode: (comment) => comment.author,
    });
    builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        commenters: t.connection(
          {
            type: User,
            select: { comments: commenters.page },
            resolve: (post, args, ctx) =>
              commenters.resolve(
                resolveRows(post.comments, post) as typeof post.comments,
                args,
                ctx,
                post,
              ),
          },
          commenters.connectionOptions({}),
        ),
        pagedComments: t.int({
          select: { comments: commenters.page },
          resolve: (post) => post.comments.length,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaField({
          type: ['Post'],
          resolve: () => db.orm.Post.where({ published: 1 }).orderBy((post) => post.id.asc()),
        }),
        commenters: t.connection(
          {
            type: User,
            resolve: async (_root, args, ctx, info) => {
              const { collection, totalCountPromise, wrap } = await commenters.applyPagination(
                db.orm.Comment,
                args,
                ctx,
                info,
              );
              return wrap(await collection.all(), await totalCountPromise);
            },
          },
          commenters.connectionOptions({}),
        ),
      }),
    });
    return builder.toSchema();
  }

  it('loads a page through a join model in the parent statement with page', async () => {
    const first = await run(
      commentersSchema(),
      '{ posts { id commenters(first: 1) { totalCount pageInfo { endCursor hasNextPage } edges { node { firstName posts { id } } } } } }',
    );
    expect(first.errors).toBeUndefined();
    expect(first.statements).toHaveLength(1);
    expect(first.data.posts).toMatchObject([
      { id: 'p-bob1', commenters: { totalCount: 0, edges: [] } },
      {
        id: 'p-hello',
        commenters: {
          totalCount: 2,
          pageInfo: { hasNextPage: true },
          edges: [{ node: { firstName: 'Alice', posts: [{ id: 'p-hello' }, { id: 'p-draft1' }] } }],
        },
      },
    ]);
    const after = first.data.posts[1].commenters.pageInfo.endCursor;
    const second = await run(
      commentersSchema(),
      'query ($after: String) { posts { commenters(first: 1, after: $after) { edges { node { firstName } } } } }',
      { variables: { after } },
    );
    expect(second.statements).toHaveLength(1);
    expect(second.data.posts[1].commenters.edges).toEqual([{ node: { firstName: 'Bob' } }]);
  });

  it('keeps the count of a page off the parent row, so a filtered page keeps it', async () => {
    const keys: string[][] = [];
    const result = await run(
      commentersSchema({
        resolveRows: (rows, post) => {
          keys.push(Object.keys(post));
          return rows.filter(() => true);
        },
      }),
      '{ posts { id commenters(first: 1) { totalCount } other: commenters(first: 1) { totalCount edges { node { firstName } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts.map((post: { other: unknown }) => post.other)).toEqual([
      { totalCount: 0, edges: [] },
      { totalCount: 2, edges: [{ node: { firstName: 'Alice' } }] },
    ]);
    expect(keys.flat().filter((key) => key.includes(':'))).toEqual([]);
  });

  it('loads no rows of a page when only totalCount is selected', async () => {
    const result = await run(commentersSchema(), '{ posts { commenters { totalCount } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      { commenters: { totalCount: 0 } },
      { commenters: { totalCount: 2 } },
    ]);
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].sql).toMatch(/count\(/i);
    expect(result.statements[0].sql).not.toMatch(/limit/i);
  });

  it('loads the rows of a page whose selection reads no count', async () => {
    const alone = await run(commentersSchema(), '{ posts { commenters { __typename } } }');
    expect(alone.errors).toBeUndefined();
    expect(alone.data.posts).toEqual([
      { commenters: { __typename: 'PostCommentersConnection' } },
      { commenters: { __typename: 'PostCommentersConnection' } },
    ]);
    const result = await run(
      commentersSchema(),
      '{ posts { a: commenters { __typename } b: commenters { totalCount } pagedComments } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([
      { a: { __typename: 'PostCommentersConnection' }, b: { totalCount: 0 }, pagedComments: 0 },
      { a: { __typename: 'PostCommentersConnection' }, b: { totalCount: 2 }, pagedComments: 2 },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('loads the rows of a page for a field that is not a connection', async () => {
    const result = await run(commentersSchema(), '{ posts { pagedComments } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual([{ pagedComments: 0 }, { pagedComments: 2 }]);
    expect(result.statements).toHaveLength(1);
  });

  it("runs a page's options once per selection, not per parent row", async () => {
    const calls = { query: 0 };
    const result = await run(
      commentersSchema({ calls }),
      '{ posts { commenters(first: 1) { edges { node { firstName } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toHaveLength(2);
    expect(calls).toEqual({ query: 1 });
  });

  it('fails the root field when a page is given an invalid cursor', async () => {
    const result = await run(
      commentersSchema(),
      '{ posts { id commenters(first: 1, after: "nope") { edges { node { firstName } } } } }',
    );
    expect(result.data.posts).toBeNull();
    expect(result.errors?.every((error) => /Invalid cursor/.test(error.message))).toBe(true);
    expect(result.statements).toHaveLength(0);
  });

  it('plans the nodes through a join model with applyPagination and info', async () => {
    const result = await run(
      commentersSchema(),
      '{ commenters(first: 2) { totalCount edges { node { firstName posts { id } } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.commenters).toEqual({
      totalCount: 2,
      edges: [
        { node: { firstName: 'Alice', posts: [{ id: 'p-hello' }, { id: 'p-draft1' }] } },
        { node: { firstName: 'Bob', posts: [{ id: 'p-bob1' }, { id: 'p-bob-draft' }] } },
      ],
    });
    expect(result.statements.filter(({ sql }) => !/count\(/i.test(sql))).toHaveLength(1);
  });

  it('loads whole rows for resolveNode without a node relation, even with info', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    const pages = prismaConnectionHelpers(builder, 'Post', {
      resolveNode: (post) => ({ post, loadedAt: 'now' }),
    });
    const Wrapped = builder
      .objectRef<{ post: { title: string }; loadedAt: string }>('Wrapped')
      .implement({
        fields: (t) => ({
          title: t.string({ resolve: (node) => node.post.title }),
          loadedAt: t.exposeString('loadedAt'),
        }),
      });
    builder.queryType({
      fields: (t) => ({
        wrapped: t.connection({
          type: Wrapped,
          resolve: async (_root, args, ctx, info) => {
            const { collection, wrap } = await pages.applyPagination(db.orm.Post, args, ctx, info);
            return wrap(await collection.all());
          },
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ wrapped(first: 1) { edges { node { title loadedAt } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.wrapped.edges).toEqual([{ node: { title: 'Bob draft', loadedAt: 'now' } }]);
    expect(result.statements).toHaveLength(1);
  });

  it('pages a named type when given its ref instead of the model name', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    const Card = builder.prismaObject('User', {
      variant: 'UserCard',
      fields: (t) => ({ name: t.exposeString('firstName') }),
    });
    const pages = prismaConnectionHelpers(builder, Card, {});
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

describe('prismaConnection query', () => {
  function schema(query: unknown) {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaConnection({
          type: 'Post',
          args: { newest: t.arg.boolean() },
          totalCount: true,
          query: query as never,
          resolve: () => db.orm.Post.where({ authorId: 'u-alice' }),
        }),
      }),
    });
    return builder.toSchema();
  }
  const desc = ['p-hello', 'p-draft1'];

  it.each<[string, unknown]>([
    ['a literal', { orderBy: { title: 'desc' } }],
    [
      'a literal with null placement',
      { orderBy: { title: { direction: 'desc', nulls: 'first' } } },
    ],
    [
      'a callback of the args',
      (args: { newest: boolean }) => ({ orderBy: { title: args.newest ? 'desc' : 'asc' } }),
    ],
  ])('orders by %s', async (_name, query) => {
    const result = await run(schema(query), '{ posts(newest: true) { nodes { id } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.posts.nodes.map((node: { id: string }) => node.id)).toEqual(desc);
  });

  it.each<[string, unknown]>([
    ['omitted', undefined],
    ['empty', { orderBy: {} }],
    ['a callback returning nothing', () => undefined],
  ])('orders by the primary key when %s', async (_name, query) => {
    const result = await run(schema(query), '{ posts { nodes { id } } }');
    expect(result.data.posts.nodes).toEqual([{ id: 'p-draft1' }, { id: 'p-hello' }]);
  });

  it('appends the key in the direction of the last column', async () => {
    const result = await run(
      schema({ orderBy: { published: 'desc' } }),
      '{ posts { nodes { id } } }',
    );
    expect(result.statements[0].sql).toMatch(/ORDER BY .*published.* DESC, .*id.* DESC/);
  });

  it("filters the resolver's collection with where, and counts what it keeps", async () => {
    const result = await run(
      schema({ where: { published: 1 } }),
      '{ posts { totalCount nodes { id } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.posts).toEqual({ totalCount: 1, nodes: [{ id: 'p-hello' }] });
  });
});
