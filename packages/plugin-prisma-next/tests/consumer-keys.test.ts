import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import { type GraphQLFieldResolver, parse, subscribe } from 'graphql';
import { describe, expect, it } from 'vitest';
import PrismaNextPlugin, { collectionFromInfo, prismaConnectionHelpers } from '../src';
import { createBuilder, run, type SampleContract, useSampleDb } from './fixtures/helpers';

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
        resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
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

describe('consumers of one relation with different arguments on one type', () => {
  it('reads each consumer from its own branch in one statement', async () => {
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

  // Edge case 1: the same relation at two levels, with other arguments at each.
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

  // Edge case 2: aliases with equal arguments load one branch.
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

  // Edge case 2: reloads are batched, whatever the length of the list.
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

  // Edge case 4: a fragment used in two places shares its walk, and so its consumers.
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

  // One response key selected by several fragments is one consumer: its resolver finds one mapping.
  it('merges the field nodes of one response key into one consumer', async () => {
    const result = await run(
      schema(),
      '{ users { p: posts(published: 1) { id } ... on User { p: posts(published: 1) { title } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0].p).toEqual([{ id: 'p-hello', title: 'Hello, Pothos' }]);
    expect(result.statements).toHaveLength(1);
  });
});

// Edge case 3: an inherited field is planned once, on the interface; an override and a fragment
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
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
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

// Edge case 5: rows beneath a connection helper's nodes and a relatedConnection's edges.
describe('connections', () => {
  it('reads consumers beneath edges.node without reloading', async () => {
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
        users: t.prismaConnection({ type: User, resolve: () => db.orm.User }),
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
  it("reads consumers beneath a connection helper's page", async () => {
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
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
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

// Edge case 6: another plugin's shallow copy keeps the combined values under their symbol.
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
  SchemaBuilder.registerPlugin('prismaNextTestConsumerCopy' as never, CopyPlugin);

  it.each(['before', 'after'] as const)('reads a copy as the row (%s)', async (position) => {
    const copy = 'prismaNextTestConsumerCopy' as never;
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: position === 'before' ? [copy, PrismaNextPlugin] : [PrismaNextPlugin, copy],
      prismaNext: { client: db.client },
    });
    const { User } = define(builder as never);
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: [User],
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
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
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
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

  const consumers =
    'publishedIds drafts { id } a: posts(published: 1) { id } n: postCount(published: 0)';
  const aliceConsumers = {
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
          resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
        }),
      }),
    });
    const result = await run(builder.toSchema(), '{ users { me { id publishedIds } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({ me: { id: 'u-alice', publishedIds: ['p-hello'] } });
    expect(result.statements).toHaveLength(1);
  });

  it("reads consumers beneath a plain field's row", async () => {
    const result = await run(
      otherSchema(),
      `{ users { firstPublished { id author { ${consumers} } } } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.users[0]).toEqual({
      firstPublished: { id: 'p-hello', author: aliceConsumers },
    });
    expect(result.statements).toHaveLength(1);
  });

  it('reads consumers beneath collectionFromInfo({ path })', async () => {
    const result = await run(otherSchema(), `{ payload { user { ${consumers} } } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.payload.user).toEqual(aliceConsumers);
    expect(result.statements).toHaveLength(1);
  });

  it('reads consumers on rows a subscription yields', async () => {
    const events = await subscribe({
      schema: otherSchema(),
      document: parse(`subscription { user { ${consumers} } }`),
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
    expect(seen).toEqual([{ user: aliceConsumers }, { user: aliceConsumers }]);
  });
});
