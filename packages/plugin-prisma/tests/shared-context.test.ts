import { subscribe as toolsSubscribe } from '@graphql-tools/executor';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { type DocumentNode, execute, type GraphQLSchema, parse, subscribe } from 'graphql';
import PrismaPlugin, { type PrismaTypesFromClient, queryFromInfo } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Executions sharing a context keep their loader mappings apart, so rows a later operation or
// subscription event loaded elsewhere never resolve a filtered relation from the rows they hold.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: object;
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    publishedPosts: t.relation('posts', { query: { where: { published: true } } }),
    allPosts: t.relation('posts'),
    // A custom resolve plans what is beneath it when its parent wasn't loaded by a plan.
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      resolve: (query, user) =>
        prisma.post.findMany({
          ...query,
          where: { authorId: user.id },
          orderBy: { id: 'asc' },
        } as never),
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    published: t.exposeBoolean('published'),
    author: t.relation('author'),
  }),
});

// Every post, drafts included, as rows loaded outside the plan hold them.
const withAllPosts = { where: { id: 1 }, include: { posts: true } } as const;

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: 'User',
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    rawUser: t.field({
      type: User,
      resolve: () => prisma.user.findUniqueOrThrow(withAllPosts),
    }),
  }),
});

builder.subscriptionType({
  fields: (t) => ({
    // The first event is planned, the second hands on a row loaded elsewhere.
    user: t.field({
      type: User,
      subscribe: async function* () {
        yield await Promise.resolve(true);
        yield false;
      },
      resolve: (planned: boolean, _args, context, info) =>
        planned
          ? prisma.user.findUniqueOrThrow({ ...queryFromInfo({ context, info }), where: { id: 1 } })
          : prisma.user.findUniqueOrThrow(withAllPosts),
    }),
    // Loads each event in `subscribe` with the planned query, as a snapshot of a row since
    // deleted: its id matches no row, so reloading it fails.
    deletedUser: t.field({
      type: User,
      subscribe: async function* (_root, _args, context, info) {
        const snapshot = await prisma.user.findUniqueOrThrow({
          ...queryFromInfo({ context, info }),
          where: { id: 1 },
        });

        yield { ...snapshot, id: -1 };
      },
      resolve: (user) => user,
    }),
    // Yields a snapshot loaded with the planned query, then a row from elsewhere holding every post.
    snapshotThenRaw: t.field({
      type: User,
      subscribe: async function* (_root, _args, context, info) {
        yield await prisma.user.findUniqueOrThrow({
          ...queryFromInfo({ context, info }),
          where: { id: 1 },
        });
        yield await prisma.user.findUniqueOrThrow(withAllPosts);
      },
      resolve: (user) => user,
    }),
    // Each event is a distinct payload whose user the resolver loads with the planned query.
    plannedEvents: t.field({
      type: User,
      subscribe: async function* () {
        yield await Promise.resolve({ id: 1 });
        yield { id: 1 };
      },
      resolve: (payload: { id: number }, _args, context, info) =>
        prisma.user.findUniqueOrThrow({
          ...queryFromInfo({ context, info }),
          where: { id: payload.id },
        }),
    }),
  }),
});

const schema = builder.toSchema();

function drafts(result: unknown) {
  return JSON.stringify(result).match(/"published":false/g)?.length ?? 0;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('executions sharing a context', () => {
  it('keeps the relation filter on rows a later operation loaded elsewhere', async () => {
    const contextValue = {};
    const planned = await execute({
      schema,
      document: parse('{ user { publishedPosts { published } } }'),
      contextValue,
    });
    const raw = await execute({
      schema,
      document: parse('{ user: rawUser { publishedPosts { published } } }'),
      contextValue,
    });

    expect(drafts(planned)).toBe(0);
    expect(raw).toEqual(planned);
  });

  it('reloads a row for a later operation sharing the context with its own selection', async () => {
    const contextValue = {};
    const query = (posts: string) =>
      execute({
        schema,
        document: parse(`{ rawUser { posts: ${posts} { published } } }`),
        contextValue,
      });

    expect(drafts(await query('allPosts'))).toBeGreaterThan(0);
    expect(drafts(await query('publishedPosts'))).toBe(0);
  });

  it('plans beneath a connection again for a later operation sharing the context', async () => {
    const contextValue = {};
    const query = (posts: string) =>
      execute({
        schema,
        document: parse(
          `{ rawUser { postsConnection(first: 1) { edges { node { author { posts: ${posts} { published } } } } } } }`,
        ),
        contextValue,
      });

    expect(drafts(await query('allPosts'))).toBeGreaterThan(0);
    expect(drafts(await query('publishedPosts'))).toBe(0);
  });
});

type Subscribe = (args: {
  schema: GraphQLSchema;
  document: DocumentNode;
  contextValue: object;
}) => unknown;

/** Every event of `source`, subscribed to with `subscribeWith` on a fresh context. */
async function events(subscribeWith: Subscribe, source: string) {
  const result = (await subscribeWith({ schema, document: parse(source), contextValue: {} })) as
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

// graphql-js gives each event its own `variableValues` (16) or `getAbortSignal` (17), while
// @graphql-tools/executor (Yoga) hands every event and the `subscribe` the same ones.
describe.each([
  ['graphql-js', subscribe as Subscribe],
  ['@graphql-tools/executor', toolsSubscribe as Subscribe],
])('subscription events through %s', (_, subscribeWith) => {
  it('keeps the relation filter on a row a later event loaded elsewhere', async () => {
    const seen = await events(
      subscribeWith,
      'subscription { user { publishedPosts { published } } }',
    );

    expect(drafts(seen[0])).toBe(0);
    expect(seen[1]).toEqual(seen[0]);
  });

  it('reloads the parent of an event its subscribe loaded with the planned query', async () => {
    queries.length = 0;

    const seen = await events(
      subscribeWith,
      'subscription { deletedUser { publishedPosts { published } } }',
    );
    const [{ errors, data }] = seen as {
      errors?: { path: unknown }[];
      data: { deletedUser: { publishedPosts: unknown } };
    }[];

    // Each event is its own execution: the snapshot's relations load from its parent row, which
    // no longer exists, as they would for a deleted row from anywhere else.
    expect(seen).toHaveLength(1);
    expect(data.deletedUser.publishedPosts).toBeNull();
    expect(errors?.map(({ path }) => path)).toEqual([['deletedUser', 'publishedPosts']]);
    expect(queries).toHaveLength(2);
  });

  it('reloads a raw event yielded after a planned snapshot', async () => {
    const seen = await events(
      subscribeWith,
      'subscription { snapshotThenRaw { publishedPosts { published } } }',
    );

    expect(seen).toHaveLength(2);
    expect(drafts(seen[0])).toBe(0);
    expect(drafts(seen[1])).toBe(0);
    expect(seen[1]).toEqual(seen[0]);
  });

  it('resolves the relations of each event from the query it planned', async () => {
    queries.length = 0;

    const seen = await events(
      subscribeWith,
      'subscription { plannedEvents { publishedPosts { published } } }',
    );

    expect(seen).toHaveLength(2);
    expect(drafts(seen[0])).toBe(0);
    expect(seen[1]).toEqual(seen[0]);
    expect(queries).toHaveLength(2);
  });
});
