import { subscribe as toolsSubscribe } from '@graphql-tools/executor';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import {
  type DocumentNode,
  execute,
  experimentalExecuteIncrementally,
  type GraphQLFieldResolver,
  type GraphQLSchema,
  parse,
  subscribe,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import PrismaNextPlugin, { collectionFromInfo, prismaConnectionHelpers } from '../src';
import { detailOf } from './fixtures/errors';
import {
  type CapturedExecution,
  createBuilder,
  deferSchema,
  run,
  runIncremental,
  type SampleContract,
  useSampleDb,
  withCapture,
} from './fixtures/helpers';

const db = useSampleDb();

// The combine() branches the ORM had to rename (see expansion-planning.test.ts).
const renamedBranches = (sql: string) => sql.match(/"[^"]*__combine__[^"]*_\d+"/g) ?? [];
const postSubqueries = (sql: string) => sql.match(/FROM "post"/g)?.length ?? 0;

type Builder = ReturnType<typeof createBuilder>;

/**
 * A type-level select of `posts` with arguments, `t.relation` with a query, and `relationCount`
 * on one type, all on the same relation with different arguments.
 */
function define(builder: Builder | PothosSchemaTypes.SchemaBuilder<never>) {
  const b = builder as Builder;
  const User = b.prismaObject('User', {
    select: { posts: { where: { published: 1 } } },
    fields: (t) => ({
      id: t.exposeID('id'),
      // What the type's select promises.
      publishedIds: t.stringList({
        resolve: (user) => user.posts.map((post) => post.id).sort(),
      }),
      drafts: t.relation('posts', {
        query: { where: { published: 0 }, orderBy: { id: 'asc' } },
      }),
      posts: t.relation('posts', {
        args: { published: t.arg.int({ required: true }) },
        query: (args) => ({
          where: { published: args.published },
          orderBy: { id: 'asc' },
        }),
      }),
      postCount: t.relationCount('posts', {
        args: { published: t.arg.int() },
        query: (args) => ({ where: args.published == null ? {} : { published: args.published } }),
      }),
    }),
  });
  const Post = b.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      author: t.relation('author', { type: User }),
    }),
  });
  return { User, Post };
}

function schema(stubs = 2) {
  const builder = createBuilder();
  const { User } = define(builder);
  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: [User],
        collection: () => db.orm.User.orderBy((user) => user.id.asc()),
      }),
      // Rows the plugin didn't load, which every planned field reloads.
      stubs: t.field({
        type: [User],
        resolve: () =>
          (['u-alice', 'u-bob', 'u-alice', 'u-bob'] as const)
            .slice(0, stubs)
            .map((id) => ({ id })) as never,
      }),
    }),
  });
  return builder.toSchema();
}

const alice = {
  published: [{ id: 'p-hello' }],
  drafts: [{ id: 'p-draft1' }],
};

describe('loads of one relation with different arguments on one type', () => {
  it('reads each load from its own branch in one statement', async () => {
    const result = await run(
      schema(),
      `{ users {
        publishedIds
        drafts { id }
        a: posts(published: 1) { id }
        b: posts(published: 0) { id }
        all: postCount
        n1: postCount(published: 1)
        n0: postCount(published: 0)
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      publishedIds: ['p-hello'],
      drafts: alice.drafts,
      a: alice.published,
      b: alice.drafts,
      all: 2,
      n1: 1,
      n0: 1,
    });
    expect(result.statements).toHaveLength(1);
  });

  // The same relation at two levels, with other arguments at each.
  it('keeps the levels of a nested relation apart', async () => {
    const result = await run(
      schema(),
      `{ users {
        id
        a: posts(published: 1) {
          id
          author { id publishedIds a: posts(published: 0) { id } n: postCount(published: 1) }
        }
        b: posts(published: 0) {
          id
          author { id a: posts(published: 1) { id } n: postCount(published: 0) }
        }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      id: 'u-alice',
      a: [
        {
          id: 'p-hello',
          author: { id: 'u-alice', publishedIds: ['p-hello'], a: alice.drafts, n: 1 },
        },
      ],
      b: [{ id: 'p-draft1', author: { id: 'u-alice', a: alice.published, n: 1 } }],
    });
    expect(result.statements).toHaveLength(1);
    expect(renamedBranches(result.statements[0]!.sql)).toEqual([]);
  });

  // Aliases with equal arguments load one branch.
  it('shares one branch between aliases with equal arguments', async () => {
    const result = await run(
      schema(),
      '{ users { a: posts(published: 1) { id } b: posts(published: 1) { title } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      a: [{ id: 'p-hello' }],
      b: [{ title: 'Hello, Pothos' }],
    });
    expect(result.statements).toHaveLength(1);
    // The type's own select is the other subquery.
    expect(postSubqueries(result.statements[0]!.sql)).toBe(2);
  });

  // Reloads are batched, whatever the length of the list.
  it.each([1, 2, 4])('reloads %i stubs in one statement', async (stubs) => {
    const result = await run(
      schema(stubs),
      `{ stubs {
        publishedIds drafts { id } a: posts(published: 1) { id author { a: posts(published: 0) { id } } }
        b: posts(published: 0) { id } n: postCount(published: 0)
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.stubs[0]).toEqual({
      publishedIds: ['p-hello'],
      drafts: alice.drafts,
      a: [{ id: 'p-hello', author: { a: alice.drafts } }],
      b: alice.drafts,
      n: 1,
    });
    // One batch reloads every row for every field.
    expect(result.statements).toHaveLength(1);
  });

  // A fragment used in two places shares its walk, and so its loads.
  it('reads a shared fragment beneath two aliases from each one', async () => {
    const result = await run(
      schema(),
      `{ users {
        a: posts(published: 1) { ...P }
        b: posts(published: 0) { ...P }
      } }
      fragment P on Post { id author { x: posts(published: 0) { id } y: posts(published: 1) { id } n: postCount } }`,
    );
    expect(result.errors).toBeUndefined();
    const author = { x: alice.drafts, y: alice.published, n: 2 };
    expect(result.data.users[0]).toEqual({
      a: [{ id: 'p-hello', author }],
      b: [{ id: 'p-draft1', author }],
    });
    expect(result.statements).toHaveLength(1);
    expect(renamedBranches(result.statements[0]!.sql)).toEqual([]);
  });

  // One response key selected by several fragments is one field: its resolver finds one mapping.
  it('merges the field nodes of one response key into one field', async () => {
    const result = await run(
      schema(),
      '{ users { p: posts(published: 1) { id } ... on User { p: posts(published: 1) { title } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0].p).toEqual([{ id: 'p-hello', title: 'Hello, Pothos' }]);
    expect(result.statements).toHaveLength(1);
  });
});

// SQL orders by an orderBy's keys in the order they are written, so it is part of what a load is.
describe('aliases whose orderBy lists the same columns in another order', () => {
  const byId = { orderBy: { id: 'asc', createdAt: 'asc' }, limit: 1 } as const;
  const byDate = { orderBy: { createdAt: 'asc', id: 'asc' }, limit: 1 } as const;
  it('load apart through t.relation', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        first: t.relation('posts', {
          args: { byDate: t.arg.boolean({ required: true }) },
          query: (args) => (args.byDate ? byDate : byId),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: [User], query: { where: { id: 'u-alice' } } }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { a: first(byDate: false) { id } b: first(byDate: true) { id } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({ a: [{ id: 'p-draft1' }], b: [{ id: 'p-hello' }] });
    expect(result.statements).toHaveLength(1);
  });

  it("load apart through a field's select", async () => {
    const builder = createBuilder();
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        first: t.stringList({
          args: { byDate: t.arg.boolean({ required: true }) },
          select: (args) => ({ posts: args.byDate ? byDate : byId }),
          resolve: (user) => user.posts.map((post) => post.id),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: [User], query: { where: { id: 'u-alice' } } }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { a: first(byDate: false) b: first(byDate: true) } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({ a: ['p-draft1'], b: ['p-hello'] });
    expect(result.statements).toHaveLength(1);
  });

  it('load apart through nestedSelection', async () => {
    const builder = createBuilder();
    const Post = builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        first: t.field({
          type: [Post],
          args: { byDate: t.arg.boolean({ required: true }) },
          select: (args, _ctx, nestedSelection) => ({
            posts: nestedSelection(args.byDate ? byDate : byId),
          }),
          resolve: (user) => user.posts,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: [User], query: { where: { id: 'u-alice' } } }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { a: first(byDate: false) { id } b: first(byDate: true) { id } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({ a: [{ id: 'p-draft1' }], b: [{ id: 'p-hello' }] });
    expect(result.statements).toHaveLength(1);
  });
});

// An inherited field is planned once, on the interface; an override and a fragment
// narrowed to an implementation are planned on the implementation.
describe('interface fields', () => {
  function interfaceSchema() {
    const builder = createBuilder();
    const I = builder.prismaInterface('User', {
      variant: 'I',
      select: { posts: { where: { published: 1 } } },
      resolveType: (row) => (row.id === 'u-bob' ? 'B' : 'A'),
      fields: (t) => ({
        id: t.exposeID('id'),
        publishedIds: t.stringList({ resolve: (user) => user.posts.map((post) => post.id) }),
        drafts: t.relation('posts', { query: { where: { published: 0 } } }),
        count: t.relationCount('posts'),
      }),
    });
    builder.prismaObject('User', { variant: 'A', interfaces: [I] });
    builder.prismaObject('User', {
      variant: 'B',
      interfaces: [I],
      fields: (t) => ({
        drafts: t.relation('posts', { query: { where: { published: 1 } } }),
        count: t.relationCount('posts', { query: { where: { published: 1 } } }),
      }),
    });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [I],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    return builder.toSchema();
  }

  it('reads inherited, overridden and narrowed fields', async () => {
    const result = await run(
      interfaceSchema(),
      `{ users {
        id publishedIds drafts { id } count
        ... on A { narrowed: drafts { id } }
        ... on B { narrowed: drafts { id } }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      {
        id: 'u-alice',
        publishedIds: ['p-hello'],
        drafts: [{ id: 'p-draft1' }],
        count: 2,
        narrowed: [{ id: 'p-draft1' }],
      },
      {
        id: 'u-bob',
        publishedIds: ['p-bob1'],
        drafts: [{ id: 'p-bob1' }],
        count: 1,
        narrowed: [{ id: 'p-bob1' }],
      },
    ]);
    // An override selected through the interface isn't planned for the implementation, so B's
    // rows reload for `drafts` and `count`. The base branch does the same.
    expect(result.statements).toHaveLength(2);
  });

  it('plans overrides narrowed to their implementation with the rest', async () => {
    const result = await run(
      interfaceSchema(),
      `{ users {
        id publishedIds
        ... on A { drafts { id } count }
        ... on B { drafts { id } count }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: 'u-alice', publishedIds: ['p-hello'], drafts: [{ id: 'p-draft1' }], count: 2 },
      { id: 'u-bob', publishedIds: ['p-bob1'], drafts: [{ id: 'p-bob1' }], count: 1 },
    ]);
    expect(result.statements).toHaveLength(1);
  });
});

// Rows beneath a connection helper's nodes and a relatedConnection's edges.
describe('connections', () => {
  it('reads loads beneath edges.node without reloading', async () => {
    const builder = createBuilder();
    const { User } = define(builder);
    builder.prismaObjectFields(User, (t) => ({
      page: t.relatedConnection('posts', {
        totalCount: true,
        query: { where: { published: 1 } },
      }),
    }));
    builder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({ type: User, collection: () => db.orm.User }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      `{ users(first: 2) { edges { node {
        publishedIds drafts { id } n: postCount(published: 0)
        page(first: 1) { totalCount edges { node { id author { a: posts(published: 0) { id } } } } }
      } } } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users.edges[0].node).toEqual({
      publishedIds: ['p-hello'],
      drafts: alice.drafts,
      n: 1,
      page: {
        totalCount: 1,
        edges: [{ node: { id: 'p-hello', author: { a: alice.drafts } } }],
      },
    });
    expect(result.statements).toHaveLength(1);
  });
  it("reads loads beneath a connection helper's page", async () => {
    const builder = createBuilder();
    const { User } = define(builder);
    const authored = prismaConnectionHelpers(builder, 'Post', { totalCount: true });
    builder.prismaObjectFields(User, (t) => ({
      authored: t.connection(
        {
          type: authored.ref,
          select: (args, ctx, nestedSelection) => ({
            posts: authored.getQuery(args, ctx, nestedSelection),
          }),
          resolve: (user, args, ctx) => authored.resolve(user.posts, args, ctx),
        },
        { fields: (c) => ({ totalCount: c.int({ resolve: (page) => page.totalCount }) }) },
      ),
    }));
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      `{ users { authored(first: 1) { totalCount edges { node { id author {
        publishedIds a: posts(published: 0) { id }
      } } } } } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0].authored).toEqual({
      totalCount: 2,
      edges: [{ node: { id: 'p-draft1', author: { publishedIds: ['p-hello'], a: alice.drafts } } }],
    });
    expect(result.statements).toHaveLength(1);
  });
});

// Another plugin's shallow copy keeps the combined values under their symbol.
describe('a plugin that copies the parent', () => {
  class CopyPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(
      resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
      fieldConfig: PothosOutputFieldConfig<Types>,
    ): GraphQLFieldResolver<unknown, Types['Context'], object> {
      if (fieldConfig.parentType !== 'User') {
        return resolver;
      }
      return (parent, args, context, info) =>
        resolver({ ...(parent as object) }, args, context, info);
    }
  }
  SchemaBuilder.registerPlugin('prismaNextTestLoadCopy' as never, CopyPlugin);

  it.each(['before', 'after'] as const)('reads a copy as the row (%s)', async (position) => {
    const copy = 'prismaNextTestLoadCopy' as never;
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: position === 'before' ? [copy, PrismaNextPlugin] : [PrismaNextPlugin, copy],
      prismaNext: { client: db.client },
    });
    const { User } = define(builder as never);
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { publishedIds drafts { id } a: posts(published: 1) { id } n: postCount(published: 0) } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      publishedIds: ['p-hello'],
      drafts: alice.drafts,
      a: alice.published,
      n: 1,
    });
    expect(result.statements).toHaveLength(1);
  });
});

// Rows returned by a field the plugin didn't build are copied for their type all the same.
describe('rows other fields return', () => {
  function otherSchema() {
    const builder = createBuilder();
    const { User, Post } = define(builder);
    builder.prismaObjectFields(User, (t) => ({
      firstPublished: t.field({
        type: Post,
        nullable: true,
        select: (_args, _ctx, nestedSelection) => ({
          posts: nestedSelection({ where: { published: 1 }, orderBy: { id: 'asc' } }),
        }),
        resolve: (user) => user.posts[0] ?? null,
      }),
    }));
    const Payload = builder.objectRef<{ user: unknown }>('Payload').implement({
      fields: (t) => ({
        user: t.field({ type: User, resolve: (payload) => payload.user as never }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        payload: t.field({
          type: Payload,
          resolve: async (_root, _args, context, info) => {
            const users = await collectionFromInfo({
              collection: db.orm.User.where({ id: 'u-alice' }),
              context,
              info,
              path: ['user'],
            });
            return { user: await users.first() };
          },
        }),
      }),
    });
    builder.subscriptionType({
      fields: (t) => ({
        user: t.field({
          type: User,
          subscribe: async function* (_root, _args, context, info) {
            const users = await collectionFromInfo({
              collection: db.orm.User.where({ id: 'u-alice' }),
              context,
              info,
            });
            yield await users.first();
            yield await users.first();
          },
          resolve: (row) => row as never,
        }),
      }),
    });
    return builder.toSchema();
  }

  const loads =
    'publishedIds drafts { id } a: posts(published: 1) { id } n: postCount(published: 0)';
  const aliceLoads = {
    publishedIds: ['p-hello'],
    drafts: alice.drafts,
    a: alice.published,
    n: 1,
  };

  it('resolves column fields of a row a plain field returns without reloading it', async () => {
    const builder = createBuilder();
    const { User } = define(builder);
    builder.prismaObjectFields(User, (t) => ({
      me: t.field({ type: User, resolve: (user) => user }),
    }));
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { me { id publishedIds } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({ me: { id: 'u-alice', publishedIds: ['p-hello'] } });
    expect(result.statements).toHaveLength(1);
  });

  it("reads loads beneath a plain field's row", async () => {
    const result = await run(
      otherSchema(),
      `{ users { firstPublished { id author { ${loads} } } } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      firstPublished: { id: 'p-hello', author: aliceLoads },
    });
    expect(result.statements).toHaveLength(1);
  });

  it('reads loads beneath collectionFromInfo({ path })', async () => {
    const result = await run(otherSchema(), `{ payload { user { ${loads} } } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.payload.user).toEqual(aliceLoads);
    expect(result.statements).toHaveLength(1);
  });

  it('reads loads on rows a subscription yields', async () => {
    const events = await subscribe({
      schema: otherSchema(),
      document: parse(`subscription { user { ${loads} } }`),
      contextValue: {},
    });
    if (!(Symbol.asyncIterator in events)) {
      throw new Error(`Expected a subscription, got ${JSON.stringify(events)}`);
    }
    const seen: unknown[] = [];
    for await (const event of events) {
      expect(event.errors).toBeUndefined();
      seen.push(event.data);
    }
    expect(seen).toEqual([{ user: aliceLoads }, { user: aliceLoads }]);
  });
});

type Subscribe = (args: {
  schema: GraphQLSchema;
  document: DocumentNode;
  contextValue: object;
}) => unknown;

// GraphQL allows one response key different arguments in fragments on different object types,
// and a reload batch hands one row to every request it merges.
describe('one response key with different arguments', () => {
  function positionSchema(defer = false) {
    const builder = createBuilder();
    const I = builder.prismaInterface('User', {
      variant: 'I',
      select: { posts: { where: { published: 1 } } },
      resolveType: (row) => (row.id === 'u-bob' ? 'B' : 'A'),
      fields: (t) => ({
        id: t.exposeID('id'),
        // The type's posts, or with `drafts` its own.
        f: t.stringList({
          args: { drafts: t.arg.boolean({ required: true }) },
          select: (args) =>
            args.drafts ? { posts: { where: { published: 0 } } } : { comments: true },
          resolve: (user) => user.posts.map((post) => post.id),
        }),
        g: t.stringList({
          args: { published: t.arg.int({ required: true }) },
          select: (args) => ({ posts: { where: { published: args.published } } }),
          resolve: (user) => user.posts.map((post) => post.id),
        }),
        n: t.relationCount('posts', {
          args: { published: t.arg.int({ required: true }) },
          query: (args) => ({ where: { published: args.published } }),
        }),
        page: t.relatedConnection('posts', {
          totalCount: true,
          args: { published: t.arg.int({ required: true }) },
          query: (args) => ({ where: { published: args.published }, orderBy: { id: 'asc' } }),
        }),
      }),
    });
    builder.prismaObject('User', { variant: 'A', interfaces: [I] });
    builder.prismaObject('User', { variant: 'B', interfaces: [I] });
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [I],
          collection: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
        user: t.prismaField({
          type: I,
          nullable: true,
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    builder.subscriptionType({
      fields: (t) => ({
        user: t.field({
          type: I,
          subscribe: async function* (_root, _args, context, info) {
            const users = await collectionFromInfo({
              collection: db.orm.User.where({ id: 'u-alice' }),
              context,
              info,
            });
            yield await users.first();
            yield await users.first();
          },
          resolve: (row) => row as never,
        }),
      }),
    });
    return defer ? deferSchema(builder) : builder.toSchema();
  }

  const page = (published: number) =>
    `page(published: ${published}, first: 5) { totalCount edges { node { id } } }`;
  const pageOf = (ids: string[]) => ({
    totalCount: ids.length,
    edges: ids.map((id) => ({ node: { id } })),
  });

  it.each([
    ['f(drafts: false)', 'f(drafts: true)', ['p-hello'], ['p-bob-draft']],
    ['g(published: 1)', 'g(published: 0)', ['p-hello'], ['p-bob-draft']],
    ['n(published: 1)', 'n(published: 0)', 1, 1],
    [page(0), page(1), pageOf(['p-draft1']), pageOf(['p-bob1'])],
  ])('reads each object type its own in fragments: %s, %s', async (onA, onB, alice, bob) => {
    const result = await run(
      positionSchema(),
      `{ users { id ... on A { x: ${onA} } ... on B { x: ${onB} } } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: 'u-alice', x: alice },
      { id: 'u-bob', x: bob },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it.each([
    ['f(drafts: false)', 'f(drafts: true)', ['p-hello'], ['p-draft1']],
    ['g(published: 1)', 'g(published: 0)', ['p-hello'], ['p-draft1']],
    ['n(published: 1)', 'n(published: 0)', 1, 1],
    [page(1), page(0), pageOf(['p-hello']), pageOf(['p-draft1'])],
  ])('reads each deferred root its own: %s, %s', async (onA, onB, a, b) => {
    const result = await runIncremental(
      positionSchema(true),
      `{ a: user { id ... @defer { x: ${onA} } } b: user { id ... @defer { x: ${onB} } } }`,
    );
    expect(result.patchErrors).toEqual([]);
    expect(result.patches).toEqual(expect.arrayContaining([{ x: a }, { x: b }]));
  });

  it('reads each variable set its own when executions share a context', async () => {
    const schema = positionSchema(true);
    const document = parse(
      'query($drafts: Boolean!) { user { id ... @defer { x: f(drafts: $drafts) } } }',
    );
    const contextValue = {};
    const patches = (drafts: boolean) =>
      Promise.resolve(
        experimentalExecuteIncrementally({
          schema,
          document,
          contextValue,
          variableValues: { drafts },
        }),
      ).then(async (result) => {
        if (!('initialResult' in result)) {
          throw new Error('Expected an incremental result');
        }
        const seen: unknown[] = [];
        for await (const patch of result.subsequentResults) {
          for (const entry of patch.incremental ?? []) {
            seen.push('data' in entry ? entry.data : entry.items);
          }
        }
        return seen;
      });
    expect(await Promise.all([patches(false), patches(true)])).toEqual([
      [{ x: ['p-hello'] }],
      [{ x: ['p-draft1'] }],
    ]);
  });

  it.each([
    ['graphql-js', subscribe as Subscribe],
    ['@graphql-tools/executor', toolsSubscribe as Subscribe],
  ])('reads each subscription event its own through %s', async (_, subscribeWith) => {
    const events = (await subscribeWith({
      schema: positionSchema(),
      document: parse(
        'subscription { user { ... on A { x: f(drafts: false) } ... on B { x: f(drafts: true) } } }',
      ),
      contextValue: {},
    })) as AsyncIterable<{ errors?: unknown; data?: unknown }>;
    const seen: unknown[] = [];
    for await (const event of events) {
      expect(event.errors).toBeUndefined();
      seen.push(event.data);
    }
    const expected = { user: { x: ['p-hello'] } };
    expect(seen).toEqual([expected, expected]);
  });
});

// A load is named by what it loads, by an id each context gives it, never by the field or the
// operation that asked for it.
describe('load ids', () => {
  it('shares one id for equal loads of two operations in one context', async () => {
    const built = schema(1);
    const contextValue = {};
    const statements: CapturedExecution[] = [];
    const [first, second] = await withCapture(statements, () =>
      Promise.all([
        execute({ schema: built, document: parse('{ stubs { drafts { id } } }'), contextValue }),
        execute({ schema: built, document: parse('{ stubs { d: drafts { id } } }'), contextValue }),
      ]),
    );
    expect(first).toEqual({ data: { stubs: [{ drafts: alice.drafts }] } });
    expect(second).toEqual({ data: { stubs: [{ d: alice.drafts }] } });
    expect(statements).toHaveLength(1);
  });

  it('reads keyed loads of rows returned through a union without reloading', async () => {
    const builder = createBuilder();
    const { User } = define(builder);
    const Result = builder.unionType('Result', { types: [User], resolveType: () => 'User' });
    builder.queryType({
      fields: (t) => ({
        search: t.field({
          type: [Result],
          resolve: async (_root, _args, context, info) => {
            const users = await collectionFromInfo({
              collection: db.orm.User.where({ id: 'u-alice' }),
              context,
              info,
              typeName: 'User',
            });
            return (await users.all()) as never;
          },
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ search { ... on User { publishedIds drafts { id } a: posts(published: 1) { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.search).toEqual([
      { publishedIds: ['p-hello'], drafts: alice.drafts, a: alice.published },
    ]);
    expect(result.statements).toHaveLength(1);
  });

  it('loads two to-one entries with different selects beneath once, each reading its own', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    const ids = (posts: readonly { id: string }[]) => posts.map((post) => post.id).sort();
    builder.prismaObject('Post', {
      fields: (t) => ({
        published: t.stringList({
          select: { author: { select: { posts: { where: { published: 1 } } } } },
          resolve: (post) => ids(post.author.posts),
        }),
        drafts: t.stringList({
          select: { author: { select: { posts: { where: { published: 0 } } } } },
          resolve: (post) => ids(post.author.posts),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        post: t.prismaField({
          type: 'Post',
          collection: () => db.orm.Post.where({ id: 'p-hello' }),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ post { published drafts } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.post).toEqual({ published: ['p-hello'], drafts: ['p-draft1'] });
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]!.sql.match(/FROM "user"/g)).toHaveLength(1);
  });

  it('fails a field whose aggregates write one key twice', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      fields: (t) => ({
        total: t.int({
          select: {
            posts: (posts) => ({ total: posts.count() }),
            comments: (comments) => ({ total: comments.count() }),
          },
          resolve: (user) => user.total,
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: 'User', collection: () => db.orm.User }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { total } }');
    expect(result.errors).toHaveLength(1);
    expect(detailOf(result.errors![0])).toBe(
      "A field's select writes 'total' on its parent twice.",
    );
  });

  it('loads one entry object reused for two relations of a field select', async () => {
    const builder = createBuilder();
    const recent = { limit: 5 } as const;
    const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id).sort();
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        commentIds: t.stringList({
          select: { posts: recent, comments: recent },
          resolve: (user) => ids(user.comments),
        }),
        postIds: t.stringList({
          select: { posts: recent, comments: recent },
          resolve: (user) => ids(user.posts),
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: User,
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { commentIds postIds } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({ commentIds: ['c-2'], postIds: ['p-draft1', 'p-hello'] });
  });

  it('loads one entry object reused for two relations of a type select', async () => {
    const builder = createBuilder();
    const recent = { limit: 5 } as const;
    const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id).sort();
    const User = builder.prismaObject('User', {
      select: { posts: recent, comments: recent },
      fields: (t) => ({
        commentIds: t.stringList({ resolve: (user) => ids(user.comments) }),
        postIds: t.stringList({ resolve: (user) => ids(user.posts) }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: User,
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { commentIds postIds } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({ commentIds: ['c-2'], postIds: ['p-draft1', 'p-hello'] });
  });

  it('loads one entry object reused by the selects of two models', async () => {
    const builder = createBuilder();
    const recent = { limit: 5 } as const;
    const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id).sort();
    const Post = builder.prismaObject('Post', {
      fields: (t) => ({
        id: t.exposeID('id'),
        commentIds: t.stringList({
          select: { comments: recent },
          resolve: (post) => ids(post.comments),
        }),
      }),
    });
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        postIds: t.stringList({ select: { posts: recent }, resolve: (user) => ids(user.posts) }),
        posts: t.relation('posts', { type: Post, query: { orderBy: { id: 'asc' } } }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: User,
          collection: () => db.orm.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ user { postIds posts { id commentIds } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.user).toEqual({
      postIds: ['p-draft1', 'p-hello'],
      posts: [
        { id: 'p-draft1', commentIds: [] },
        { id: 'p-hello', commentIds: ['c-1', 'c-2'] },
      ],
    });
  });

  it('rejects two nested type-level entries of one relation that disagree', () => {
    const builder = createBuilder();
    builder.prismaObject('User', {
      select: { posts: { select: { comments: { where: { id: 'c-1' } } } } },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.prismaObject('Comment', {
      select: { post: { select: { comments: { where: { id: 'c-2' } } } } },
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    expect(() => builder.toSchema()).toThrow(
      "'User' and 'Comment' both select 'comments', with different definitions. Every row of model 'Post' holds one value for it",
    );
  });
});
