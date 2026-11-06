import SchemaBuilder from '@pothos/core';
import { execute, parse, subscribe } from 'graphql';
import PrismaPlugin, { type PrismaTypesFromClient, queryFromInfo } from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

// Executions sharing a context keep their loader mappings apart, so rows a later operation or
// subscription event loaded elsewhere never resolve a filtered relation from the rows they hold.
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
    publishedPosts: t.relation('posts', { query: { where: { published: true } } }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    published: t.exposeBoolean('published'),
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
});
