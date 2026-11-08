import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse, subscribe } from 'graphql';
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
    // deleted: its id matches no row, so its fields can only resolve from what it holds.
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
  }),
});

const schema = builder.toSchema();

function drafts(result: unknown) {
  return JSON.stringify(result).match(/"published":false/g)?.length ?? 0;
}

describe('executions sharing a context', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

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

  it('keeps the relation filter on a row a later subscription event loaded elsewhere', async () => {
    const events = await subscribe({
      schema,
      document: parse('subscription { user { publishedPosts { published } } }'),
      contextValue: {},
    });

    if (!(Symbol.asyncIterator in events)) {
      throw new Error(`Expected a subscription, got ${JSON.stringify(events)}`);
    }

    const seen: unknown[] = [];

    for await (const event of events) {
      seen.push(event);
    }

    expect(drafts(seen[0])).toBe(0);
    expect(seen[1]).toEqual(seen[0]);
  });

  it('resolves an event from what the subscribe that loaded it planned', async () => {
    queries.length = 0;

    const events = await subscribe({
      schema,
      document: parse(
        'subscription { deletedUser { publishedPosts { published author { allPosts { published } } } } }',
      ),
      contextValue: {},
    });

    if (!(Symbol.asyncIterator in events)) {
      throw new Error(`Expected a subscription, got ${JSON.stringify(events)}`);
    }

    const seen: unknown[] = [];

    for await (const event of events) {
      seen.push(event);
    }

    const [{ errors, data }] = seen as {
      errors?: unknown;
      data: {
        deletedUser: { publishedPosts: { published: boolean; author: { allPosts: unknown[] } }[] };
      };
    }[];
    const [post] = data.deletedUser.publishedPosts;

    expect(seen).toHaveLength(1);
    expect(errors).toBeUndefined();
    expect(drafts(data.deletedUser.publishedPosts.map(({ published }) => ({ published })))).toBe(0);
    expect(drafts(post.author.allPosts)).toBeGreaterThan(0);
    // The snapshot alone: nothing reloaded the deleted row.
    expect(queries).toHaveLength(1);
  });

  it('reloads a raw event yielded after a planned snapshot', async () => {
    const events = await subscribe({
      schema,
      document: parse('subscription { snapshotThenRaw { publishedPosts { published } } }'),
      contextValue: {},
    });

    if (!(Symbol.asyncIterator in events)) {
      throw new Error(`Expected a subscription, got ${JSON.stringify(events)}`);
    }

    const seen: unknown[] = [];

    for await (const event of events) {
      seen.push(event);
    }

    expect(seen).toHaveLength(2);
    expect(drafts(seen[0])).toBe(0);
    expect(drafts(seen[1])).toBe(0);
    expect(seen[1]).toEqual(seen[0]);
  });
});
