import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// A `relatedConnection` with a custom `resolve` installs a fallback resolver, which runs whenever
// the parent row was not loaded with the connection's rows on it.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  relay: {
    nodesOnConnection: true,
  },
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
    filterConnectionTotalCount: true,
  },
});

interface FallbackQuery {
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
  take?: number;
  skip?: number;
  cursor?: unknown;
}

const resolveCalls: FallbackQuery[] = [];

// A resolver that does not key off the parent at all, so a page of rows comes back even for a
// parent that matches no row in the database.
const resolveDetached = (query: FallbackQuery) => {
  resolveCalls.push(query);

  return prisma.post.findMany({ ...query, orderBy: { id: 'asc' } } as never);
};

const resolvePosts = (query: FallbackQuery, user: { id: number }) => {
  resolveCalls.push(query);

  return prisma.post.findMany({
    ...query,
    where: { authorId: user.id },
    orderBy: { id: 'asc' },
  } as never);
};

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});

builder.prismaObject('User', {
  variant: 'PostAuthor',
  fields: (t) => ({ id: t.exposeID('id') }),
});

// A node type in select mode, where what the plan selected is visible in the emitted query rather
// than implied by include mode's "every column".
const SelectedPost = builder.prismaObject('Post', {
  variant: 'SelectedPost',
  select: { id: true },
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content', { nullable: true }),
  }),
});

// A connection object shared between fields: the recipe has to name the *node* type, since a
// shared wrapper could never resolve to one model.
const SharedPostConnection = builder.connectionObject(
  { type: SelectedPost, name: 'SharedPostConnection' },
  { name: 'SharedPostEdge' },
);

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relatedConnection('posts', { cursor: 'id', resolve: resolvePosts }),
    // A page big enough to reach the end of the relation, past the default max size.
    allPosts: t.relatedConnection('posts', { cursor: 'id', maxSize: 500, resolve: resolvePosts }),
    selectedPosts: t.relatedConnection('posts', {
      cursor: 'id',
      type: SelectedPost,
      resolve: resolvePosts,
    }),
    postsWithCount: t.relatedConnection('posts', {
      cursor: 'id',
      totalCount: true,
      resolve: resolvePosts,
    }),
    publishedWithCount: t.relatedConnection('posts', {
      cursor: 'id',
      totalCount: true,
      query: { where: { published: true } },
      resolve: resolvePosts,
    }),
    sharedPosts: t.relatedConnection(
      'posts',
      { cursor: 'id', type: SelectedPost, resolve: resolvePosts },
      SharedPostConnection,
    ),
    detachedWithCount: t.relatedConnection('posts', {
      cursor: 'id',
      totalCount: true,
      resolve: resolveDetached,
    }),
    detachedPosts: t.relatedConnection('posts', { cursor: 'id', resolve: resolveDetached }),
    // A user-defined field on the connection object, which reads `totalCount` off the connection
    // the same way the generated field does.
    countWithCustomField: t.relatedConnection(
      'posts',
      { cursor: 'id', totalCount: true, resolve: resolvePosts },
      {
        fields: (c) => ({
          doubled: c.int({
            resolve: (con) => ((con as { totalCount?: number }).totalCount ?? 0) * 2,
          }),
          countKind: c.string({
            resolve: (con) => typeof (con as { totalCount?: unknown }).totalCount,
          }),
        }),
      },
    ),
    // No `resolve`: never installs a fallback, so an unplanned parent reloads itself through the
    // model loader.
    plainPosts: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
    plainCountWithCustomField: t.relatedConnection(
      'posts',
      { cursor: 'id', totalCount: true },
      {
        name: 'PlainCountConnection',
        fields: (c) => ({
          doubled: c.int({
            resolve: (con) => ((con as { totalCount?: number }).totalCount ?? 0) * 2,
          }),
          countKind: c.string({
            resolve: (con) => typeof (con as { totalCount?: unknown }).totalCount,
          }),
        }),
      },
    ),
  }),
});

builder.queryType({
  fields: (t) => ({
    // An unplanned parent: the row is built by hand, so nothing beneath it was planned into a
    // prisma query and every field on it has to load itself.
    unplannedUser: t.field({
      type: User,
      resolve: () => ({ id: 1 }) as never,
    }),
    // Five unplanned parents, for counting the queries a list of them costs.
    unplannedUsers: t.field({
      type: [User],
      resolve: () => [1, 2, 3, 4, 5].map((id) => ({ id })) as never,
    }),
    plannedUsers: t.prismaField({
      type: [User],
      resolve: (query) =>
        prisma.user.findMany({ ...query, where: { id: { in: [1, 2, 3, 4, 5] } } }),
    }),
    // A parent that corresponds to no row at all.
    ghostUser: t.field({
      type: User,
      resolve: () => ({ id: 999999 }) as never,
    }),
    // The same user through a planned query, for comparing the two paths.
    plannedUser: t.prismaField({
      type: User,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

const run = (document: string) => execute({ schema, document: gql(document), contextValue: {} });

// biome-ignore lint/suspicious/noExplicitAny: reading a result the document's own shape defines
const connection = (result: { data?: unknown }, root: string, field: string): any =>
  // biome-ignore lint/suspicious/noExplicitAny: as above
  (result.data as any)[root][field];

// The prisma call the planned path emitted for the relation, which is the connection's own query
// nested under the parent's.
const plannedRelationQuery = (relation = 'posts') =>
  (queries[0] as { args: { include?: Record<string, unknown> } }).args.include?.[relation];

describe('relatedConnection with a custom resolve, unplanned parent', () => {
  afterEach(() => {
    queries.length = 0;
    resolveCalls.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('resolves through edges { node } instead of failing to plan the wrapper', async () => {
    const result = await run(`{
      unplannedUser { posts(first: 2) { edges { node { id title } } } }
    }`);

    expect(result.errors).toBeUndefined();
    expect(resolveCalls).toHaveLength(1);
    expect(connection(result, 'unplannedUser', 'posts').edges).toHaveLength(2);
  });

  it('resolves through a nodes selection', async () => {
    const result = await run(`{
      unplannedUser { posts(first: 2) { nodes { id title } } }
    }`);

    expect(result.errors).toBeUndefined();
    expect(connection(result, 'unplannedUser', 'posts').nodes).toHaveLength(2);
  });

  it('plans the node selection, not the wrapper, in select mode', async () => {
    const result = await run(`{
      unplannedUser { selectedPosts(first: 2) { edges { node { title } } } }
    }`);

    expect(result.errors).toBeUndefined();
    // `id` is the cursor column the recipe seeds, without which `formatCursor` would have no
    // column to read; `title` is what the document asked for beneath `edges { node }`.
    expect(resolveCalls[0].select).toStrictEqual({ id: true, title: true });
  });

  it('plans the node selection through a nodes selection in select mode', async () => {
    const result = await run(`{
      unplannedUser { selectedPosts(first: 2) { nodes { content } } }
    }`);

    expect(result.errors).toBeUndefined();
    expect(resolveCalls[0].select).toStrictEqual({ id: true, content: true });
  });

  it('plans the node selection through a fragment on the node type', async () => {
    const result = await run(`
      { unplannedUser { selectedPosts(first: 1) { edges { node { ...PostFields } } } } }
      fragment PostFields on SelectedPost { title content }
    `);

    expect(result.errors).toBeUndefined();
    expect(resolveCalls[0].select).toStrictEqual({ id: true, title: true, content: true });
  });

  it('names the node type, not the wrapper, for a shared connection object', async () => {
    const result = await run(`{
      unplannedUser { sharedPosts(first: 1) { edges { node { title } } } }
    }`);

    expect(result.errors).toBeUndefined();
    expect(resolveCalls[0].select).toStrictEqual({ id: true, title: true });
  });

  it('plans relations beneath the node', async () => {
    const result = await run(`{
      unplannedUser { posts(first: 1) { edges { node { id author { id } } } } }
    }`);

    expect(result.errors).toBeUndefined();
    expect(resolveCalls[0].include).toStrictEqual({ author: true });
    expect(connection(result, 'unplannedUser', 'posts').edges[0].node.author.id).toBe('1');
  });

  it('seeds the cursor column even when the document does not select it', async () => {
    const result = await run(`{
      unplannedUser { selectedPosts(first: 1) { edges { cursor node { title } } } }
    }`);

    expect(result.errors).toBeUndefined();
    expect(resolveCalls[0].select).toStrictEqual({ id: true, title: true });
    expect(connection(result, 'unplannedUser', 'selectedPosts').edges[0].cursor).toEqual(
      expect.any(String),
    );
  });
});

describe('relatedConnection fallback totalCount', () => {
  afterEach(() => {
    queries.length = 0;
    resolveCalls.length = 0;
  });

  it('answers totalCount, which the parent row cannot carry', async () => {
    const result = await run(`{
      unplannedUser { postsWithCount(first: 2) { totalCount edges { node { id } } } }
    }`);

    expect(result.errors).toBeUndefined();
    const posts = connection(result, 'unplannedUser', 'postsWithCount');
    expect(posts.totalCount).toBe(250);
    expect(posts.edges).toHaveLength(2);
  });

  it('filters totalCount by the field query when filterConnectionTotalCount is on', async () => {
    const result = await run(`{
      unplannedUser { publishedWithCount(first: 1) { totalCount edges { node { id } } } }
    }`);

    expect(result.errors).toBeUndefined();
    // 250 posts per user, published for `j > 100`: 149 of them.
    expect(connection(result, 'unplannedUser', 'publishedWithCount').totalCount).toBe(149);
  });

  it('does not count when the document does not select totalCount', async () => {
    const result = await run(`{
      unplannedUser { postsWithCount(first: 1) { edges { node { id } } } }
    }`);

    expect(result.errors).toBeUndefined();
    // Only the resolver's own findMany: `totalCount` is unselected, so no count is loaded.
    expect(queries).toStrictEqual([expect.objectContaining({ model: 'Post', action: 'findMany' })]);
  });

  it('answers a totalCount-only selection, where nothing is selected under the node paths', async () => {
    const result = await run(`{
      unplannedUser { postsWithCount { totalCount } }
    }`);

    expect(result.errors).toBeUndefined();
    expect(connection(result, 'unplannedUser', 'postsWithCount').totalCount).toBe(250);
    // `Plan.fromInfo` answers `undefined` here — nothing is selected under `nodes`/`edges.node`
    // — and the fallback plans the recipe's own seed instead.
    expect(resolveCalls).toHaveLength(0);
  });
});

describe('relatedConnection fallback pagination', () => {
  afterEach(() => {
    queries.length = 0;
    resolveCalls.length = 0;
  });

  it('reports hasNextPage from the connection query take', async () => {
    const result = await run(`{
      unplannedUser {
        posts(first: 1) {
          pageInfo { hasNextPage hasPreviousPage }
          edges { node { id } }
        }
      }
    }`);

    expect(result.errors).toBeUndefined();
    const posts = connection(result, 'unplannedUser', 'posts');
    // The connection query asks for one row plus a probe; the probe is sliced off and reported
    // as a next page.
    expect(resolveCalls[0].take).toBe(2);
    expect(posts.edges).toHaveLength(1);
    expect(posts.pageInfo.hasNextPage).toBe(true);
    expect(posts.pageInfo.hasPreviousPage).toBe(false);
  });

  it('reports hasNextPage false on the last page', async () => {
    const result = await run(`{
      unplannedUser {
        allPosts(first: 500) { pageInfo { hasNextPage } edges { node { id } } }
      }
    }`);

    expect(result.errors).toBeUndefined();
    const posts = connection(result, 'unplannedUser', 'allPosts');
    expect(posts.edges).toHaveLength(250);
    expect(posts.pageInfo.hasNextPage).toBe(false);
  });

  it('pages forward with after, reporting hasPreviousPage', async () => {
    const first = await run(`{
      unplannedUser { posts(first: 1) { edges { cursor node { id } } } }
    }`);

    expect(first.errors).toBeUndefined();
    const firstEdge = connection(first, 'unplannedUser', 'posts').edges[0];

    resolveCalls.length = 0;

    const second = await run(`{
      unplannedUser {
        posts(first: 1, after: "${firstEdge.cursor}") {
          pageInfo { hasNextPage hasPreviousPage }
          edges { node { id } }
        }
      }
    }`);

    expect(second.errors).toBeUndefined();
    const posts = connection(second, 'unplannedUser', 'posts');
    expect(posts.edges).toHaveLength(1);
    expect(posts.edges[0].node.id).not.toBe(firstEdge.node.id);
    expect(posts.pageInfo.hasNextPage).toBe(true);
    expect(posts.pageInfo.hasPreviousPage).toBe(true);
  });

  it('pages backward with last', async () => {
    const result = await run(`{
      unplannedUser {
        posts(last: 2) { pageInfo { hasNextPage hasPreviousPage } edges { node { id } } }
      }
    }`);

    expect(result.errors).toBeUndefined();
    const posts = connection(result, 'unplannedUser', 'posts');
    expect(resolveCalls[0].take).toBe(-3);
    expect(posts.edges).toHaveLength(2);
    expect(posts.pageInfo.hasPreviousPage).toBe(true);
    expect(posts.pageInfo.hasNextPage).toBe(false);
  });
});

describe('relatedConnection fallback agrees with the planned path', () => {
  afterEach(() => {
    queries.length = 0;
    resolveCalls.length = 0;
  });

  it.each([
    ['posts', 'edges { node { id title } }'],
    ['posts', 'nodes { id title }'],
    ['posts', 'edges { node { id author { id } } }'],
    ['selectedPosts', 'edges { cursor node { title content } }'],
    ['selectedPosts', 'nodes { title }'],
  ])('emits the same relation query as the planned path: %s %s', async (field, selection) => {
    const document = `${field}(first: 2) { ${selection} }`;

    const fallback = await run(`{ unplannedUser { ${document} } }`);
    expect(fallback.errors).toBeUndefined();
    const fallbackQuery = resolveCalls[0];

    resolveCalls.length = 0;
    queries.length = 0;

    const planned = await run(`{ plannedUser { ${document} } }`);
    expect(planned.errors).toBeUndefined();
    // The planned parent carries the rows, so the fallback never runs for it.
    expect(resolveCalls).toHaveLength(0);

    expect(fallbackQuery).toStrictEqual(plannedRelationQuery());
    expect(connection(planned, 'plannedUser', field)).toStrictEqual(
      connection(fallback, 'unplannedUser', field),
    );
  });

  it('produces the same page and totalCount as the planned path', async () => {
    const document =
      'postsWithCount(first: 1) { totalCount pageInfo { hasNextPage } nodes { id } }';

    const fallback = await run(`{ unplannedUser { ${document} } }`);
    expect(fallback.errors).toBeUndefined();

    queries.length = 0;
    resolveCalls.length = 0;

    const planned = await run(`{ plannedUser { ${document} } }`);
    expect(planned.errors).toBeUndefined();

    expect(connection(fallback, 'unplannedUser', 'postsWithCount')).toStrictEqual(
      connection(planned, 'plannedUser', 'postsWithCount'),
    );
  });

  it('leaves a relatedConnection without a resolve on the loader path', async () => {
    const result = await run(`{
      unplannedUser { plainPosts(first: 2) { totalCount edges { node { id } } } }
    }`);

    expect(result.errors).toBeUndefined();
    expect(resolveCalls).toHaveLength(0);
    const posts = connection(result, 'unplannedUser', 'plainPosts');
    expect(posts.totalCount).toBe(250);
    expect(posts.edges).toHaveLength(2);
  });
});

describe('relatedConnection fallback review follow-ups', () => {
  afterEach(() => {
    queries.length = 0;
    resolveCalls.length = 0;
  });

  it('hands user-defined connection fields the same totalCount the generated field gets', async () => {
    const selection = 'countWithCustomField(first: 1) { totalCount countKind doubled }';

    const fallback = await run(`{ unplannedUser { ${selection} } }`);
    expect(fallback.errors).toBeUndefined();
    expect(connection(fallback, 'unplannedUser', 'countWithCustomField')).toEqual({
      totalCount: 250,
      countKind: 'number',
      doubled: 500,
    });
  });

  it('matches the loader path for a user-defined connection field', async () => {
    const fallback = await run(
      '{ unplannedUser { countWithCustomField(first: 1) { totalCount countKind doubled } } }',
    );
    const loader = await run(
      '{ unplannedUser { plainCountWithCustomField(first: 1) { totalCount countKind doubled } } }',
    );

    expect(fallback.errors).toBeUndefined();
    expect(loader.errors).toBeUndefined();
    expect(connection(fallback, 'unplannedUser', 'countWithCustomField')).toStrictEqual(
      connection(loader, 'unplannedUser', 'plainCountWithCustomField'),
    );
  });

  it('refuses to invent a totalCount for a parent that is not a row', async () => {
    const result = await run(`{
      ghostUser { detachedWithCount(first: 2) { totalCount edges { node { id } } } }
    }`);

    // The resolver still returns rows, so a count of 0 would sit next to a non-empty page on a
    // non-nullable Int.
    expect(result.errors?.[0]?.message).toMatch(
      /Unable to load totalCount for User\.detachedWithCount/,
    );
  });

  it('still answers a page for a parent that is not a row when totalCount is not selected', async () => {
    const result = await run(`{
      ghostUser { detachedPosts(first: 2) { edges { node { id } } } }
    }`);

    // Nothing here needs the parent to exist, so nothing errors.
    expect(result.errors).toBeUndefined();
    expect(connection(result, 'ghostUser', 'detachedPosts').edges).toHaveLength(2);
  });

  it('costs one query per parent for a totalCount-only selection over a list', async () => {
    const result = await run('{ unplannedUsers { postsWithCount { totalCount } } }');

    expect(result.errors).toBeUndefined();
    expect(
      // biome-ignore lint/suspicious/noExplicitAny: reading a result the document's own shape defines
      (result.data as any).unplannedUsers.map((u: any) => u.postsWithCount.totalCount),
    ).toStrictEqual([250, 250, 250, 250, 250]);

    // Five counts and nothing else.
    expect(queries).toHaveLength(5);
    expect(queries.every((q) => (q as { model: string }).model === 'User')).toBe(true);
    expect(resolveCalls).toHaveLength(0);

    // The same unplanned parents cost as much through the model loader.
    queries.length = 0;
    const viaLoader = await run('{ unplannedUsers { plainPosts { totalCount } } }');

    expect(viaLoader.errors).toBeUndefined();
    expect(queries).toHaveLength(5);
  });

  it('does not ask the resolver for rows it would throw away on a totalCount-only selection', async () => {
    const result = await run(`{
      unplannedUser { postsWithCount { totalCount } }
    }`);

    expect(result.errors).toBeUndefined();
    expect(connection(result, 'unplannedUser', 'postsWithCount').totalCount).toBe(250);
    expect(resolveCalls).toHaveLength(0);
    expect(queries).toStrictEqual([
      expect.objectContaining({ model: 'User', action: 'findUnique' }),
    ]);
  });
});
