import { subscribe as toolsSubscribe } from '@graphql-tools/executor';
import { type DocumentNode, type GraphQLSchema, parse, subscribe } from 'graphql';
import { describe, expect, it } from 'vitest';
import { collectionFromInfo } from '../src';
import { createBuilder, deferSchema, run, runIncremental, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

interface Item {
  kind: 'A' | 'B';
  userId: string;
}

/** `A` and `B` reach the same `User` fields at one response path, with what each asks for. */
function itemSchema(defer = false) {
  const builder = createBuilder();
  builder.prismaNode('User', {
    id: { field: 'id' },
    fields: (t) => ({
      name: t.exposeString('firstName'),
      posts: t.relation('posts', {
        args: { limit: t.arg.int({ required: true }) },
        query: (args) => ({ limit: args.limit, orderBy: { id: 'asc' } }),
      }),
      n: t.relationCount('posts', {
        args: { published: t.arg.int({ required: true }) },
        query: (args) => ({ where: { published: args.published } }),
      }),
      g: t.stringList({
        args: { published: t.arg.int({ required: true }) },
        select: (args) => ({ posts: { where: { published: args.published } } }),
        resolve: (user) => user.posts.map((post) => post.id),
      }),
    }),
  });
  builder.prismaObject('Post', {
    fields: (t) => ({ id: t.exposeID('id'), author: t.relation('author') }),
  });
  const ItemRef = builder.interfaceRef<Item>('Item').implement({
    resolveType: (item) => item.kind,
    fields: (t) => ({ kind: t.exposeString('kind') }),
  });
  for (const kind of ['A', 'B'] as const) {
    builder.objectRef<Item>(kind).implement({
      interfaces: [ItemRef],
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          resolve: (query, item) => query.where({ id: item.userId }).first(),
        }),
        node: t.node({ id: (item) => ({ type: 'User', id: item.userId }) }),
      }),
    });
  }
  builder.queryType({
    fields: (t) => ({
      items: t.field({
        type: [ItemRef],
        args: { userId: t.arg.id({ required: true }) },
        resolve: (_, { userId }): Item[] => [
          { kind: 'A', userId: String(userId) },
          { kind: 'B', userId: String(userId) },
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
            yield await Promise.resolve<Item>({ kind, userId: 'u-alice' });
          }
        },
        resolve: (item) => item,
      }),
    }),
  });
  return defer ? deferSchema(builder) : builder.toSchema();
}

type Subscribe = (args: {
  schema: GraphQLSchema;
  document: DocumentNode;
  contextValue: object;
}) => unknown;

async function events(
  subscribeWith: Subscribe,
  schema: GraphQLSchema,
  source: string,
  contextValue: object = {},
) {
  const result = (await subscribeWith({ schema, document: parse(source), contextValue })) as
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

describe('reload plans for one response path beneath different types', () => {
  it.each([
    [
      'posts(limit: 1) { id }',
      'posts(limit: 2) { id }',
      [{ id: 'p-draft1' }],
      [{ id: 'p-draft1' }, { id: 'p-hello' }],
    ],
    ['n(published: 1)', 'n(published: 9)', 1, 0],
    ['g(published: 1)', 'g(published: 0)', ['p-hello'], ['p-draft1']],
  ])('reloads a deferred %s and %s each with its own arguments', async (onA, onB, a, b) => {
    const result = await runIncremental(
      itemSchema(true),
      `{ items(userId: "u-alice") {
        ... on A { user { name ... @defer { x: ${onA} } } }
        ... on B { user { name ... @defer { x: ${onB} } } }
      } }`,
    );
    expect(result.patchErrors).toEqual([]);
    expect(result.patches).toHaveLength(2);
    expect(result.patches).toEqual(expect.arrayContaining([{ x: a }, { x: b }]));
  });

  it('loads a node with the selection of its own branch', async () => {
    const result = await run(
      itemSchema(),
      `{ items(userId: "u-alice") {
        kind
        ... on A { node { ... on User { x: n(published: 1) } } }
        ... on B { node { ... on User { x: n(published: 9) } } }
      } }`,
    );
    expect(result.errors).toBeUndefined();
    expect(result.data.items).toEqual([
      { kind: 'A', node: { x: 1 } },
      { kind: 'B', node: { x: 0 } },
    ]);
  });

  describe.each([
    ['graphql-js', subscribe as Subscribe],
    ['@graphql-tools/executor', toolsSubscribe as Subscribe],
  ])('subscription events through %s', (_, subscribeWith) => {
    it('loads each event’s node with the selection of its type', async () => {
      expect(
        await events(
          subscribeWith,
          itemSchema(),
          `subscription { item {
            kind
            ... on A { node { ... on User { x: n(published: 1) } } }
            ... on B { node { ... on User { x: n(published: 9) } } }
          } }`,
        ),
      ).toEqual([
        { data: { item: { kind: 'A', node: { x: 1 } } } },
        { data: { item: { kind: 'B', node: { x: 0 } } } },
      ]);
    });
  });

  it('shares a plan between the paths one fragment is spread at', async () => {
    const result = await runIncremental(
      itemSchema(true),
      `{ alice: items(userId: "u-alice") { ...F } bob: items(userId: "u-bob") { ...F } }
      fragment F on Item {
        kind
        ... on A {
          user { name ... @defer { x: posts(limit: 1) { id author { name } } } }
          node { ... on User { y: posts(limit: 1) { id author { name } } } }
        }
      }`,
    );
    expect(result.patchErrors).toEqual([]);
    expect(result.initial.errors).toBeUndefined();
    const alicePosts = [{ id: 'p-draft1', author: { name: 'Alice' } }];
    const bobPosts = [{ id: 'p-bob-draft', author: { name: 'Bob' } }];
    expect(result.initial.data).toEqual({
      alice: [{ kind: 'A', user: { name: 'Alice' }, node: { y: alicePosts } }, { kind: 'B' }],
      bob: [{ kind: 'A', user: { name: 'Bob' }, node: { y: bobPosts } }, { kind: 'B' }],
    });
    expect(result.patches).toHaveLength(2);
    expect(result.patches).toEqual(expect.arrayContaining([{ x: alicePosts }, { x: bobPosts }]));
  });
});

/** Each event sets `published` on the context before it is yielded, for `n` to count by. */
function eventSchema() {
  const builder = createBuilder<{ published: number }>();
  const User = builder.prismaNode('User', {
    id: { field: 'id' },
    fields: (t) => ({
      n: t.relationCount('posts', {
        query: (_args, ctx) => ({ where: { published: ctx.published } }),
      }),
    }),
  });
  const Event = builder.objectRef<{ userId: string }>('Event').implement({
    fields: (t) => ({
      user: t.node({ id: (event) => ({ type: 'User', id: event.userId }) }),
    }),
  });
  builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
  builder.subscriptionType({
    fields: (t) => ({
      event: t.field({
        type: Event,
        subscribe: async function* (_root, _args, context) {
          for (const published of [1, 9]) {
            context.published = published;
            yield await Promise.resolve({ userId: 'u-alice' });
          }
        },
        resolve: (event) => event,
      }),
      // Loads in `subscribe`, which plans for the subscription rather than for the event, so each
      // event reloads its fields.
      user: t.field({
        type: User,
        subscribe: async function* (_root, _args, context, info) {
          for (const published of [1, 9]) {
            context.published = published;
            const users = await collectionFromInfo({
              collection: db.orm.User.where({ id: 'u-alice' }),
              context,
              info,
            });
            yield (await users.first())!;
          }
        },
        resolve: (user) => user,
      }),
    }),
  });
  return builder.toSchema();
}

describe.each([
  ['graphql-js', subscribe as Subscribe],
  ['@graphql-tools/executor', toolsSubscribe as Subscribe],
])('reload plans for each subscription event through %s', (_, subscribeWith) => {
  it('runs query callbacks again for each event', async () => {
    expect(
      await events(
        subscribeWith,
        eventSchema(),
        'subscription { event { user { ... on User { n } } } }',
        { published: 0 },
      ),
    ).toEqual([{ data: { event: { user: { n: 1 } } } }, { data: { event: { user: { n: 0 } } } }]);
  });

  it('runs query callbacks again for each event a subscribe loaded', async () => {
    expect(
      await events(subscribeWith, eventSchema(), 'subscription { user { n } }', { published: 0 }),
    ).toEqual([{ data: { user: { n: 1 } } }, { data: { user: { n: 0 } } }]);
  });
});
