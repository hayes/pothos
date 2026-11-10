import SchemaBuilder from '@pothos/core';
import RelayPlugin, { encodeGlobalID } from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { defineRelations, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { DefaultLogger } from 'drizzle-orm/logger';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import {
  DirectiveLocation,
  GraphQLBoolean,
  GraphQLDirective,
  GraphQLNonNull,
  GraphQLString,
  parse,
} from 'graphql';
import DrizzlePlugin from '../src';
import { client } from './example/db';
import * as tables from './example/db/schema';

// An exposed column is read from the row when the row holds it, whether or not the planned query
// loaded the row. Anything else a field needs still reloads the row.
const relations = defineRelations(tables, (r) => ({
  posts: {
    author: r.one.users({ from: r.posts.authorId, to: r.users.id }),
    // Only posts with an id some user has: the rest have none.
    sameIdUser: r.one.users({ from: r.posts.postId, to: r.users.id }),
  },
  users: {
    posts: r.many.posts({ from: r.users.id, to: r.posts.authorId }),
  },
}));

const statements: string[] = [];
const db = drizzle({
  client,
  relations,
  logger: new DefaultLogger({ writer: { write: (message) => statements.push(message) } }),
});
// Rows a resolver fetched for itself, outside the statements a test counts.
const plainDb = drizzle({ client, relations });

type Db = typeof db;

const deferDirective = new GraphQLDirective({
  name: 'defer',
  locations: [DirectiveLocation.FRAGMENT_SPREAD, DirectiveLocation.INLINE_FRAGMENT],
  args: {
    if: { type: new GraphQLNonNull(GraphQLBoolean), defaultValue: true },
    label: { type: GraphQLString },
  },
});

const seen: unknown[] = [];

function createSchema(order: 'scope-auth first' | 'drizzle first', clientDb: Db = db) {
  const builder = new SchemaBuilder<{
    DrizzleRelations: typeof relations;
    Context: {};
    AuthScopes: {};
  }>({
    plugins:
      order === 'scope-auth first'
        ? [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin]
        : [RelayPlugin, DrizzlePlugin, ScopeAuthPlugin],
    drizzle: { client: () => clientDb, getTableConfig, relations },
    scopeAuth: { authScopes: () => ({}) },
  });

  const User = builder.drizzleNode('users', {
    name: 'User',
    id: { column: (user) => user.id },
    fields: (t) => ({
      username: t.exposeString('username'),
      firstName: t.exposeString('firstName', { nullable: true }),
      postCount: t.relatedCount('posts'),
      postsConnection: t.relatedConnection('posts', {
        query: { orderBy: { postId: 'asc' } },
      }),
      firstPostIds: t.intList({
        select: {
          with: { posts: { columns: { postId: true }, limit: 2, orderBy: { postId: 'asc' } } },
        },
        resolve: (user) => user.posts.map((post) => post.postId),
      }),
      lowerUsername: t.string({
        select: { extras: { lowerUsername: (users) => sql<string>`lower(${users.username})` } },
        resolve: (user) => user.lowerUsername,
      }),
    }),
  });

  const Post = builder.drizzleObject('posts', {
    name: 'Post',
    fields: (t) => ({
      postId: t.exposeInt('postId'),
      title: t.exposeString('title'),
      slug: t.exposeString('slug', { nullable: true }),
      published: t.exposeInt('published'),
      author: t.relation('author'),
      sameIdUser: t.relation('sameIdUser', { nullable: true }),
    }),
  });

  // Rows of this type need only `postId`, so a row may lack any other column.
  const SlimPost = builder.drizzleObject('posts', {
    variant: 'SlimPost',
    select: { columns: { postId: true } },
    fields: (t) => ({
      postId: t.exposeInt('postId'),
      title: t.exposeString('title'),
      content: t.exposeString('content'),
      slug: t.exposeString('slug', { nullable: true }),
      author: t.relation('author'),
    }),
  });

  // A row returned as the interface needs only `postId`; the implementation's checks read more.
  const PostInterface = builder.drizzleInterface('posts', {
    variant: 'PostInterface',
    select: { columns: { postId: true } },
    resolveType: () => 'GuardedPost',
    fields: (t) => ({
      postId: t.exposeInt('postId'),
    }),
  });

  builder.drizzleObject('posts', {
    variant: 'GuardedPost',
    interfaces: [PostInterface],
    select: { columns: { postId: true, published: true, authorId: true } },
    authScopes: (post) => {
      seen.push(['type', post.postId, post.published]);
      return post.published === 1;
    },
    fields: (t) => ({
      title: t.exposeString('title', {
        nullable: true,
        authScopes: (post) => {
          seen.push(['field', post.postId, post.authorId]);
          return post.authorId === 1;
        },
      }),
      content: t.exposeString('content', { nullable: true }),
    }),
  });

  // Rows of this type need `postId` and `published`; the type's check reads `published`.
  const PublishedPost = builder.drizzleObject('posts', {
    variant: 'PublishedPost',
    select: { columns: { postId: true, published: true } },
    authScopes: (post) => {
      seen.push(['published', post.postId, post.published]);
      return post.published === 1;
    },
    fields: (t) => ({
      postId: t.exposeInt('postId'),
      title: t.exposeString('title'),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      retitledPost: t.field({
        type: Post,
        nullable: true,
        args: { id: t.arg.int({ required: true }), title: t.arg.string({ required: true }) },
        resolve: async (_root, { id, title }) => {
          const row = await plainDb.query.posts.findFirst({ where: { postId: id } });

          return row && { ...row, title };
        },
      }),
      missingPost: t.field({
        type: Post,
        nullable: true,
        resolve: () => missingPost,
      }),
      flippedPosts: t.field({
        type: [PublishedPost],
        nullable: { list: false, items: true },
        args: { ids: t.arg.intList({ required: true }) },
        resolve: async (_root, { ids }) => {
          const rows = await plainDb.query.posts.findMany({
            where: { postId: { in: ids } },
            orderBy: { postId: 'asc' },
          });

          return rows.map((row) => ({ ...row, published: row.published === 1 ? 0 : 1 }));
        },
      }),
      posts: t.field({
        type: [Post],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (_root, { ids }) =>
          plainDb.query.posts.findMany({
            where: { postId: { in: ids } },
            orderBy: { postId: 'asc' },
          }),
      }),
      post: t.field({
        type: Post,
        nullable: true,
        args: { id: t.arg.int({ required: true }) },
        resolve: (_root, { id }) => plainDb.query.posts.findFirst({ where: { postId: id } }),
      }),
      plannedPosts: t.drizzleField({
        type: [Post],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (query, _root, { ids }) =>
          clientDb.query.posts.findMany(
            query({ where: { postId: { in: ids } }, orderBy: { postId: 'asc' } }),
          ),
      }),
      slimPosts: t.field({
        type: [SlimPost],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (_root, { ids }) =>
          plainDb.query.posts.findMany({
            columns: { postId: true, title: true },
            where: { postId: { in: ids } },
            orderBy: { postId: 'asc' },
          }),
      }),
      plannedSlimPosts: t.drizzleField({
        type: [SlimPost],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (query, _root, { ids }) =>
          clientDb.query.posts.findMany(
            query({ where: { postId: { in: ids } }, orderBy: { postId: 'asc' } }),
          ),
      }),
      handBuiltSlimPosts: t.field({
        type: [SlimPost],
        resolve: () => handBuiltSlimPosts,
      }),
      guardedPosts: t.field({
        type: [PostInterface],
        nullable: { list: false, items: true },
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (_root, { ids }) =>
          plainDb.query.posts.findMany({
            columns: { postId: true, title: true },
            where: { postId: { in: ids } },
            orderBy: { postId: 'asc' },
          }),
      }),
      users: t.field({
        type: [User],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (_root, { ids }) =>
          plainDb.query.users.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } }),
      }),
    }),
  });

  return builder.toSchema({ directives: [deferDirective] });
}

const fixture = await plainDb.query.posts.findMany({
  where: { postId: { in: [1, 2, 3, 16, 120, 151] } },
  with: { author: true, sameIdUser: true },
  orderBy: { postId: 'asc' },
});
const postById = new Map(fixture.map((post) => [post.postId, post]));
const post = (id: number) => postById.get(id)!;
const fixtureUsers = await plainDb.query.users.findMany({
  where: { id: { in: [1, 2] } },
  with: { posts: { orderBy: { postId: 'asc' } } },
  orderBy: { id: 'asc' },
});

// Built by hand: the first holds `title`, the second holds the key with nothing in it.
const titled = { postId: 2, title: post(2).title };
const undefinedTitle = { postId: 3, title: undefined };
const handBuiltSlimPosts = [titled, undefinedTitle];

// A complete row whose id no post has.
const missingPostId = 999_999;
const missingPost = {
  ...(await plainDb.query.posts.findFirst({ where: { postId: 2 } }))!,
  postId: missingPostId,
  title: 'Not stored',
};

const schema = createSchema('scope-auth first');

function run(source: string, target = schema) {
  statements.length = 0;
  seen.length = 0;

  return execute({ schema: target, document: parse(source), contextValue: {} });
}

const postFields = (id: number) => ({
  postId: id,
  title: post(id).title,
  slug: post(id).slug,
  published: post(id).published,
});

describe('exposed columns on rows the plugin did not load', () => {
  it('reads exposed columns from complete rows without reloading them', async () => {
    const result = await run('{ posts(ids: [1, 2, 3]) { postId title slug published } }');

    expect(result).toEqual({ data: { posts: [1, 2, 3].map(postFields) } });
    expect(statements).toHaveLength(0);
  });

  it('reloads a requested column a hand-built row lacks', async () => {
    const result = await run('{ handBuiltSlimPosts { postId content } }');

    expect(result).toEqual({
      data: {
        handBuiltSlimPosts: [
          { postId: 2, content: post(2).content },
          { postId: 3, content: post(3).content },
        ],
      },
    });
    expect(statements).toHaveLength(1);
  });

  it('reloads a column whose key the row holds without a value', async () => {
    const result = await run('{ handBuiltSlimPosts { postId title } }');

    expect(result).toEqual({
      data: {
        handBuiltSlimPosts: [
          { postId: 2, title: post(2).title },
          { postId: 3, title: post(3).title },
        ],
      },
    });
    expect(statements).toHaveLength(1);
  });

  it('reads a null column from the row', async () => {
    expect(post(151).slug).toBeNull();

    const result = await run('{ post(id: 151) { postId slug } }');

    expect(result).toEqual({ data: { post: { postId: 151, slug: null } } });
    expect(statements).toHaveLength(0);
  });

  it('reloads a column left out of the query that loaded the row', async () => {
    const result = await run('{ slimPosts(ids: [1, 2]) { postId title content } }');

    expect(result).toEqual({
      data: {
        slimPosts: [1, 2].map((id) => ({
          postId: id,
          title: post(id).title,
          content: post(id).content,
        })),
      },
    });
    expect(statements).toHaveLength(1);
  });

  it('still reloads a to-one relation beside exposed columns', async () => {
    const result = await run(`{
      posts(ids: [2, 120]) {
        postId
        title
        author { username }
        sameIdUser { username }
      }
    }`);

    expect(post(120).sameIdUser).toBeNull();
    expect(result).toEqual({
      data: {
        posts: [2, 120].map((id) => ({
          postId: id,
          title: post(id).title,
          author: { username: post(id).author!.username },
          sameIdUser: post(id).sameIdUser && { username: post(id).sameIdUser!.username },
        })),
      },
    });
    expect(statements).toHaveLength(1);
  });

  it('still reloads selects, counts and connections', async () => {
    const result = await run(`{
      users(ids: [1, 2]) {
        username
        firstName
        firstPostIds
        lowerUsername
        postCount
        postsConnection(first: 1) { edges { node { postId } } }
      }
    }`);

    expect(result).toEqual({
      data: {
        users: fixtureUsers.map((user) => ({
          username: user.username,
          firstName: user.firstName,
          firstPostIds: user.posts.slice(0, 2).map((p) => p.postId),
          lowerUsername: user.username.toLowerCase(),
          postCount: user.posts.length,
          postsConnection: { edges: [{ node: { postId: user.posts[0].postId } }] },
        })),
      },
    });
    expect(statements).toHaveLength(1);
  });

  it('reads planned rows of a type with a select, and reloads a partial row', async () => {
    const result = await run(`{
      plannedSlimPosts(ids: [1, 2]) { postId title slug }
      handBuiltSlimPosts { postId title slug }
    }`);

    expect(result).toEqual({
      data: {
        plannedSlimPosts: [1, 2].map((id) => ({
          postId: id,
          title: post(id).title,
          slug: post(id).slug,
        })),
        handBuiltSlimPosts: [2, 3].map((id) => ({
          postId: id,
          title: post(id).title,
          slug: post(id).slug,
        })),
      },
    });
    // The planned query selects only what the type and the fields need.
    expect(statements[0]).toMatch(
      /^Query: select "d0"\."id" as "postId", "d0"\."title" as "title", "d0"\."slug" as "slug" from "posts"/,
    );
    expect(statements).toHaveLength(2);
  });

  it('resolves exposed columns in a deferred fragment the same', async () => {
    const result = await run(`{
      plannedPosts(ids: [1, 2]) { postId ... @defer { title slug } }
      posts(ids: [1, 2]) { postId ... @defer { title slug } }
    }`);

    const expected = [1, 2].map((id) => ({
      postId: id,
      title: post(id).title,
      slug: post(id).slug,
    }));

    expect(result).toEqual({ data: { plannedPosts: expected, posts: expected } });
  });

  it('reads exposed columns beneath a reloaded row', async () => {
    const result = await run(`{
      node(id: "${encodeGlobalID('User', 1)}") { ... on User { username firstName } }
      posts(ids: [2]) { author { username firstName } }
    }`);

    expect(result).toEqual({
      data: {
        node: { username: post(2).author!.username, firstName: post(2).author!.firstName },
        posts: [
          { author: { username: post(2).author!.username, firstName: post(2).author!.firstName } },
        ],
      },
    });
  });

  it('returns the value a row holds, not the stored one', async () => {
    expect(post(2).title).not.toBe('Changed');

    const result = await run('{ retitledPost(id: 2, title: "Changed") { postId title } }');

    expect(result).toEqual({ data: { retitledPost: { postId: 2, title: 'Changed' } } });
    expect(statements).toHaveLength(0);
  });

  it('reads exposed columns from a row that is not stored, and errors on a relation', async () => {
    const result = await run('{ missingPost { postId title sameIdUser { username } } }');

    expect(result.data).toEqual({
      missingPost: { postId: missingPostId, title: 'Not stored', sameIdUser: null },
    });
    expect(result.errors?.map((error) => [error.path, error.message])).toEqual([
      [['missingPost', 'sameIdUser'], 'Unexpected error.'],
    ]);
    expect(statements).toHaveLength(1);
  });

  it('resolves a planned list beside unplanned rows of the same type', async () => {
    const result = await run(`{
      plannedPosts(ids: [1, 2]) { postId title author { username } }
      posts(ids: [2, 3]) { postId title author { username } }
    }`);

    const expected = (id: number) => ({
      postId: id,
      title: post(id).title,
      author: { username: post(id).author!.username },
    });

    expect(result).toEqual({
      data: { plannedPosts: [1, 2].map(expected), posts: [2, 3].map(expected) },
    });
    expect(statements).toHaveLength(2);
  });
});

describe.each([
  'scope-auth first',
  'drizzle first',
] as const)('scope checks on exposed columns (%s)', (order) => {
  const authSchema = createSchema(order);

  it('passes the checks the loaded row, while the row holds the exposed column', async () => {
    const result = await run(
      '{ guardedPosts(ids: [1, 2, 16]) { postId ... on GuardedPost { title } } }',
      authSchema,
    );

    // Post 1 is unpublished, so the type denies it; post 16 has another author, so `title` does.
    expect(result.data).toEqual({
      guardedPosts: [
        { postId: null, title: null },
        { postId: 2, title: post(2).title },
        { postId: 16, title: null },
      ],
    });
    expect(result.errors?.map((error) => [error.path, error.message])).toEqual([
      [['guardedPosts', 0, 'postId'], 'Not authorized to read fields for GuardedPost'],
      [['guardedPosts', 0, 'title'], 'Not authorized to read fields for GuardedPost'],
      [['guardedPosts', 2, 'title'], 'Not authorized to resolve GuardedPost.title'],
    ]);
    expect(seen).toEqual([
      ['type', 1, 0],
      ['type', 2, 1],
      ['field', 2, 1],
      ['type', 16, 1],
      ['field', 16, 2],
    ]);
    // One reload, for the columns the checks read.
    expect(statements).toHaveLength(1);
  });

  it('passes the type check the published value the row holds', async () => {
    expect([post(1).published, post(2).published]).toEqual([0, 1]);

    const result = await run('{ flippedPosts(ids: [1, 2]) { postId title } }', authSchema);

    expect(result.data).toEqual(flippedData);
    expect(result.errors?.map((error) => [error.path, error.message])).toEqual(flippedErrors);
    expect(seen).toEqual(flippedSeen);
    expect(statements).toHaveLength(0);
  });
});

// Post 1 is returned as published and post 2 as unpublished.
const flippedData = {
  flippedPosts: [
    { postId: 1, title: post(1).title },
    { postId: null, title: null },
  ],
};
const flippedErrors = [
  [['flippedPosts', 1, 'postId'], 'Not authorized to read fields for PublishedPost'],
  [['flippedPosts', 1, 'title'], 'Not authorized to read fields for PublishedPost'],
];
const flippedSeen = [
  ['published', 1, 1],
  ['published', 2, 0],
];

it('gives the same type check result in either plugin order', async () => {
  const results = [];

  for (const order of ['scope-auth first', 'drizzle first'] as const) {
    const result = await run('{ flippedPosts(ids: [1, 2]) { postId title } }', createSchema(order));

    results.push({ result, seen: [...seen], statements: statements.length });
  }

  expect(results[1]).toEqual(results[0]);
});

describe('reloading many rows', () => {
  // Reads of the key column on the rows a reload returns, counted through the client.
  let keyReads = 0;

  const countRows = (rows: unknown) =>
    Array.isArray(rows)
      ? rows.map(
          (row: Record<string, unknown>) =>
            new Proxy(row, {
              get: (target, key, receiver) => {
                if (key === 'postId') {
                  keyReads += 1;
                }

                return Reflect.get(target, key, receiver);
              },
            }),
        )
      : rows;

  const countingDb = new Proxy(db, {
    get: (target, key, receiver) => {
      const value: unknown = Reflect.get(target, key, receiver);

      if (key !== 'query') {
        return value;
      }

      return new Proxy(target.query, {
        get: (queries, table, queriesReceiver) => {
          const api: unknown = Reflect.get(queries, table, queriesReceiver);

          if (table !== 'posts') {
            return api;
          }

          return {
            findMany: (config: Parameters<Db['query']['posts']['findMany']>[0]) => {
              // The loader only waits for the rows.
              return target.query.posts.findMany(config).then(countRows);
            },
          };
        },
      });
    },
  });

  const countingSchema = createSchema('scope-auth first', countingDb);

  async function reload(count: number) {
    const ids = Array.from({ length: count }, (_, index) => index + 1);
    keyReads = 0;

    const result = await run(
      `{ posts(ids: [${ids.join(', ')}]) { postId author { username } } }`,
      countingSchema,
    );

    expect(result.errors).toBeUndefined();
    expect(statements).toHaveLength(1);

    return keyReads;
  }

  it('matches reloaded rows in time linear in the rows', async () => {
    const small = await reload(50);
    const large = await reload(100);

    expect(large).toBeLessThanOrEqual(small * 2.2);
  });
});
