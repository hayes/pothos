import { execute as toolsExecute, subscribe as toolsSubscribe } from '@graphql-tools/executor';
import SchemaBuilder from '@pothos/core';
import {
  type DocumentNode,
  type ExecutionResult,
  execute,
  type GraphQLSchema,
  parse,
  subscribe,
} from 'graphql';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

// Fragments on different types can merge different field nodes into one response path. A field
// whose parent was loaded without its selection is planned for the nodes it was reached with.

/** How many times a plan has asked `User.n` for its filter. */
let nPlans = 0;

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: object;
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    // Loads through the relation's fallback query.
    posts: t.relation('posts', {
      args: { take: t.arg.int({ required: true }) },
      query: (args) => ({ take: args.take, orderBy: { id: 'asc' } }),
    }),
    // Loads through the relation's own resolver, with a query planned for what is beneath it.
    postsOf: t.relation('posts', {
      args: { take: t.arg.int({ required: true }) },
      query: (args) => ({ take: args.take, orderBy: { id: 'asc' } }),
      resolve: (query, user) => prisma.post.findMany({ ...query, where: { authorId: user.id } }),
    }),
    // Loads through a reload of the parent.
    n: t.relationCount('posts', {
      args: { published: t.arg.boolean({ required: true }) },
      where: (args) => {
        nPlans += 1;
        return { published: args.published };
      },
    }),
    // No arguments: @graphql-tools/executor coerces them with a graphql vitest doesn't inline.
    published: t.relationCount('posts', { where: { published: true } }),
    drafts: t.relationCount('posts', { where: { published: false } }),
    firstPost: t.relation('posts', { query: { take: 1, orderBy: { id: 'asc' } } }),
    firstTwoPosts: t.relation('posts', { query: { take: 2, orderBy: { id: 'asc' } } }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({ id: t.exposeID('id'), author: t.relation('author') }),
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
      user: t.field({
        type: User,
        resolve: (item) => prisma.user.findUniqueOrThrow({ where: { id: item.userId } }),
      }),
    }),
  });
}

const items = (userId: number): Item[] => [
  { kind: 'A', userId },
  { kind: 'B', userId },
];

const Group = builder.objectRef<object>('Group').implement({
  fields: (t) => ({
    items: t.field({
      type: [ItemRef],
      args: { userId: t.arg.int({ required: true }) },
      resolve: (_, { userId }) => items(userId),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    items: t.field({
      type: [ItemRef],
      args: { userId: t.arg.int({ required: true }) },
      resolve: (_, { userId }) => items(userId),
    }),
    group: t.field({ type: Group, resolve: () => ({}) }),
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

type Execute = (args: {
  schema: GraphQLSchema;
  document: DocumentNode;
  contextValue: object;
}) => Promise<ExecutionResult>;

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

describe('plans for one response path beneath different types', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('loads a relation with the arguments of its own branch', async () => {
    const result = await run(`{ items(userId: 1) {
      ... on A { user { x: posts(take: 1) { id } } }
      ... on B { user { x: posts(take: 2) { id } } }
    } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      items: [{ user: { x: [{ id: '1' }] } }, { user: { x: [{ id: '1' }, { id: '2' }] } }],
    });
  });

  it('plans beneath a relation with its own resolver for the selection of its own branch', async () => {
    const result = await run(`{ items(userId: 1) {
      ... on A { user { x: postsOf(take: 1) { author { n(published: true) } } } }
      ... on B { user { x: postsOf(take: 1) { author { n(published: false) } } } }
    } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      items: [{ user: { x: [{ author: { n: 149 } }] } }, { user: { x: [{ author: { n: 101 } }] } }],
    });
  });

  it('reloads a parent with the selection of its own branch', async () => {
    const result = await run(`{ items(userId: 1) {
      ... on A { user { x: n(published: true) } }
      ... on B { user { x: n(published: false) } }
    } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ items: [{ user: { x: 149 } }, { user: { x: 101 } }] });
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
            ... on A { user { x: published y: firstPost { id } } }
            ... on B { user { x: drafts y: firstTwoPosts { id } } }
          } }`,
        ),
      ).toEqual([
        { data: { item: { user: { x: 149, y: [{ id: '1' }] } } } },
        { data: { item: { user: { x: 101, y: [{ id: '1' }, { id: '2' }] } } } },
      ]);
    });
  });

  it('shares a plan between the paths one fragment is spread at', async () => {
    nPlans = 0;
    const result =
      await run(`{ group { first: items(userId: 1) { ...F } second: items(userId: 2) { ...F } } }
      fragment F on Item {
        ... on A {
          user {
            id
            x: n(published: true)
            y: posts(take: 1) { id author { id } }
            z: postsOf(take: 1) { author { id } }
          }
        }
      }`);

    expect(result.errors).toBeUndefined();
    expect(nPlans).toBe(1);
    expect(result.data?.group).toEqual({
      first: [
        {
          user: {
            id: '1',
            x: 149,
            y: [{ id: '1', author: { id: '1' } }],
            z: [{ author: { id: '1' } }],
          },
        },
        {},
      ],
      second: [
        {
          user: {
            id: '2',
            x: 149,
            y: [{ id: '251', author: { id: '2' } }],
            z: [{ author: { id: '2' } }],
          },
        },
        {},
      ],
    });
  });
});

// Each event sets `published` on the context before it is yielded, and each of `publish` and
// `unpublish` before it resolves, for the counts to filter by.
const eventBuilder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { published: boolean };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const EventUser = eventBuilder.prismaObject('User', {
  fields: (t) => ({
    // Loads through a reload of the parent.
    n: t.relationCount('posts', { where: (_args, ctx) => ({ published: ctx.published }) }),
    // Loads through the relation's own resolver, with a query planned for what is beneath it.
    firstPost: t.relation('posts', {
      query: { take: 1, orderBy: { id: 'asc' } },
      resolve: (query, user) => prisma.post.findMany({ ...query, where: { authorId: user.id } }),
    }),
  }),
});

eventBuilder.prismaObject('Post', {
  fields: (t) => ({ author: t.relation('author') }),
});

eventBuilder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });

eventBuilder.subscriptionType({
  fields: (t) => ({
    user: t.field({
      type: EventUser,
      subscribe: async function* (_root, _args, context) {
        for (const published of [true, false]) {
          context.published = published;
          yield await Promise.resolve(1);
        }
      },
      // Loaded without the query, so what is beneath it loads on its own.
      resolve: (id) => prisma.user.findUniqueOrThrow({ where: { id } }),
    }),
  }),
});

// No arguments, as above: each field sets its own `published`.
eventBuilder.mutationType({
  fields: (t) => {
    const set = (published: boolean) =>
      t.field({
        type: EventUser,
        resolve: (_root, _args, context) => {
          context.published = published;
          // Loaded without the query, so what is beneath it loads on its own.
          return prisma.user.findUniqueOrThrow({ where: { id: 1 } });
        },
      });

    return { publish: set(true), unpublish: set(false) };
  },
});

const eventSchema = eventBuilder.toSchema();

describe.each([
  ['graphql-js', execute as Execute],
  ['@graphql-tools/executor', toolsExecute as Execute],
])('plans for serial mutation fields through %s', (_, executeWith) => {
  it('runs select callbacks again for each root field a fragment is spread under', async () => {
    const result = await executeWith({
      schema: eventSchema,
      document: parse(`mutation { a: publish { ...F } b: unpublish { ...F } }
        fragment F on User { n }`),
      contextValue: { published: false },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ a: { n: 149 }, b: { n: 101 } });
  });
});

describe.each([
  ['graphql-js', subscribe as Subscribe],
  ['@graphql-tools/executor', toolsSubscribe as Subscribe],
])('plans for each subscription event through %s', (_, subscribeWith) => {
  it('runs select callbacks again for each event', async () => {
    expect(
      await events(
        subscribeWith,
        'subscription { user { n firstPost { author { n } } } }',
        eventSchema,
        { published: false },
      ),
    ).toEqual([
      { data: { user: { n: 149, firstPost: [{ author: { n: 149 } }] } } },
      { data: { user: { n: 101, firstPost: [{ author: { n: 101 } }] } } },
    ]);
  });
});
