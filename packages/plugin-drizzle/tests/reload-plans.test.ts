import { subscribe as toolsSubscribe } from '@graphql-tools/executor';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { and, eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { type DocumentNode, execute, type GraphQLSchema, parse, subscribe } from 'graphql';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations } from './example/db';
import { posts } from './example/db/schema';

// Fragments on different types can merge different field nodes into one response path. A field
// whose parent was loaded without its selection, or a node, is planned for the nodes it was
// reached with.
const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations; Context: object }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  relay: {},
  scopeAuth: { authScopes: () => ({}) },
});

const User = builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    posts: t.relation('posts', {
      args: { limit: t.arg.int({ required: true }) },
      query: (args) => ({ limit: args.limit, orderBy: { postId: 'asc' } }),
    }),
    n: t.relatedCount('posts', {
      args: { published: t.arg.int({ required: true }) },
      where: (args) => eq(posts.published, args.published),
    }),
    // No arguments: @graphql-tools/executor coerces them with a graphql vitest doesn't inline.
    published: t.relatedCount('posts', { where: eq(posts.published, 1) }),
    drafts: t.relatedCount('posts', { where: eq(posts.published, 0) }),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({ id: t.exposeID('postId'), author: t.relation('author') }),
});

interface Item {
  kind: 'A' | 'B';
  userId: number;
}

const ItemRef = builder.interfaceRef<Item>('Item').implement({
  resolveType: (item) => item.kind,
  fields: (t) => ({ kind: t.exposeString('kind') }),
});

for (const kind of ['A', 'B'] as const) {
  builder.objectRef<Item>(kind).implement({
    interfaces: [ItemRef],
    fields: (t) => ({
      // Loaded without the query, so what is beneath it loads on its own.
      user: t.drizzleField({
        type: User,
        nullable: true,
        resolve: (_query, item) => db.query.users.findFirst({ where: { id: item.userId } }),
      }),
      node: t.node({ id: (item) => ({ type: 'User', id: String(item.userId) }) }),
    }),
  });
}

builder.queryType({
  fields: (t) => ({
    items: t.field({
      type: [ItemRef],
      args: { userId: t.arg.int({ required: true }) },
      resolve: (_, { userId }): Item[] => [
        { kind: 'A', userId },
        { kind: 'B', userId },
      ],
    }),
  }),
});

builder.subscriptionType({
  fields: (t) => ({
    item: t.field({
      type: ItemRef,
      subscribe: async function* () {
        for (const kind of ['A', 'B'] as const) {
          yield await Promise.resolve<Item>({ kind, userId: 1 });
        }
      },
      resolve: (item) => item,
    }),
  }),
});

const schema = builder.toSchema();

const run = (source: string) => execute({ schema, document: parse(source), contextValue: {} });

type Subscribe = (args: {
  schema: GraphQLSchema;
  document: DocumentNode;
  contextValue: object;
}) => unknown;

async function events(
  subscribeWith: Subscribe,
  source: string,
  on: GraphQLSchema = schema,
  contextValue: object = {},
) {
  const result = (await subscribeWith({ schema: on, document: parse(source), contextValue })) as
    | AsyncIterable<unknown>
    | object;

  if (!(Symbol.asyncIterator in result)) {
    throw new Error(`Expected a subscription, got ${JSON.stringify(result)}`);
  }

  const seen: unknown[] = [];

  for await (const event of result) {
    seen.push(event);
  }

  return seen;
}

const postIds = async (authorId: number, limit: number) =>
  (
    await db.query.posts.findMany({
      where: { authorId },
      orderBy: { postId: 'asc' },
      limit,
    })
  ).map((post) => ({ id: String(post.postId) }));

const count = (authorId: number, published: number) =>
  db.$count(posts, and(eq(posts.authorId, authorId), eq(posts.published, published)));

describe('plans for one response path beneath different types', () => {
  it('loads a relation with the arguments of its own branch', async () => {
    const result = await run(`{ items(userId: 1) {
      ... on A { user { x: posts(limit: 1) { id } } }
      ... on B { user { x: posts(limit: 2) { id } } }
    } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      items: [{ user: { x: await postIds(1, 1) } }, { user: { x: await postIds(1, 2) } }],
    });
  });

  it('reloads a parent with the selection of its own branch', async () => {
    const result = await run(`{ items(userId: 1) {
      ... on A { user { x: n(published: 1) } }
      ... on B { user { x: n(published: 0) } }
    } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      items: [{ user: { x: await count(1, 1) } }, { user: { x: await count(1, 0) } }],
    });
  });

  it('loads a node with the selection of its own branch', async () => {
    const result = await run(`{ items(userId: 1) {
      ... on A { node { ... on User { x: n(published: 1) } } }
      ... on B { node { ... on User { x: n(published: 0) } } }
    } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      items: [{ node: { x: await count(1, 1) } }, { node: { x: await count(1, 0) } }],
    });
  });

  describe.each([
    ['graphql-js', subscribe as Subscribe],
    ['@graphql-tools/executor', toolsSubscribe as Subscribe],
  ])('subscription events through %s', (_, subscribeWith) => {
    it('loads each event with the selection of its type', async () => {
      expect(
        await events(
          subscribeWith,
          `subscription { item {
            ... on A { user { x: published } node { ... on User { y: published } } }
            ... on B { user { x: drafts } node { ... on User { y: drafts } } }
          } }`,
        ),
      ).toEqual([
        { data: { item: { user: { x: await count(1, 1) }, node: { y: await count(1, 1) } } } },
        { data: { item: { user: { x: await count(1, 0) }, node: { y: await count(1, 0) } } } },
      ]);
    });
  });

  it('shares a plan between the paths one fragment is spread at', async () => {
    const result = await run(`{ first: items(userId: 1) { ...F } second: items(userId: 2) { ...F } }
      fragment F on Item {
        ... on A {
          user { x: n(published: 1) y: posts(limit: 1) { id } }
          node { ... on User { z: posts(limit: 2) { id } } }
        }
      }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      first: [
        {
          user: { x: await count(1, 1), y: await postIds(1, 1) },
          node: { z: await postIds(1, 2) },
        },
        {},
      ],
      second: [
        {
          user: { x: await count(2, 1), y: await postIds(2, 1) },
          node: { z: await postIds(2, 2) },
        },
        {},
      ],
    });
  });
});

// Each event sets `published` on the context before it is yielded, for the counts to filter by.
const eventBuilder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { published: number };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  relay: {},
  scopeAuth: { authScopes: () => ({}) },
});

const EventUser = eventBuilder.drizzleNode('users', {
  name: 'EventUser',
  id: { column: (user) => user.id },
  fields: (t) => ({
    n: t.relatedCount('posts', { where: (_args, ctx) => eq(posts.published, ctx.published) }),
  }),
});

const Event = eventBuilder.objectRef<{ userId: number }>('Event').implement({
  fields: (t) => ({
    // Loaded without the query, so what is beneath it loads on its own.
    user: t.drizzleField({
      type: EventUser,
      nullable: true,
      resolve: (_query, event) => db.query.users.findFirst({ where: { id: event.userId } }),
    }),
    node: t.node({ id: (event) => ({ type: 'EventUser', id: String(event.userId) }) }),
  }),
});

eventBuilder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });

eventBuilder.subscriptionType({
  fields: (t) => ({
    event: t.field({
      type: Event,
      subscribe: async function* (_root, _args, context) {
        for (const published of [1, 0]) {
          context.published = published;
          yield await Promise.resolve({ userId: 1 });
        }
      },
      resolve: (event) => event,
    }),
  }),
});

const eventSchema = eventBuilder.toSchema();

describe.each([
  ['graphql-js', subscribe as Subscribe],
  ['@graphql-tools/executor', toolsSubscribe as Subscribe],
])('plans for each subscription event through %s', (_, subscribeWith) => {
  it('runs select callbacks again for each event', async () => {
    expect(
      await events(
        subscribeWith,
        'subscription { event { user { n } node { ... on EventUser { n } } } }',
        eventSchema,
        { published: 0 },
      ),
    ).toEqual([
      { data: { event: { user: { n: await count(1, 1) }, node: { n: await count(1, 1) } } } },
      { data: { event: { user: { n: await count(1, 0) }, node: { n: await count(1, 0) } } } },
    ]);
  });
});
