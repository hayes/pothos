import SchemaBuilder from '@pothos/core';
import { execute, parse } from 'graphql';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Two parents at one response path: `Planned.user` is loaded with the field's query, and
// `Raw.user` is a row its resolver fetched itself. What the query loaded for the first says
// nothing about the second, even when both select the same thing.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: object;
}>({
  plugins: [PrismaPlugin],
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    n: t.relationCount('posts', {
      args: { published: t.arg.boolean({ required: true }) },
      where: (args) => ({ published: args.published }),
    }),
    g: t.int({
      args: { published: t.arg.boolean({ required: true }) },
      select: (args) => ({ posts: { where: { published: args.published }, select: { id: true } } }),
      resolve: (user) => user.posts.length,
    }),
  }),
});

interface Item {
  kind: 'Planned' | 'Raw';
  userId: number;
}

const ItemRef = builder.interfaceRef<Item>('Item').implement({
  resolveType: (item) => item.kind,
  fields: (t) => ({ kind: t.exposeString('kind') }),
});

builder.objectRef<Item>('Planned').implement({
  interfaces: [ItemRef],
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query, item) =>
        prisma.user.findUniqueOrThrow({ ...query, where: { id: item.userId } }),
    }),
  }),
});

builder.objectRef<Item>('Raw').implement({
  interfaces: [ItemRef],
  fields: (t) => ({
    user: t.field({
      type: User,
      resolve: (item) => prisma.user.findUniqueOrThrow({ where: { id: item.userId } }),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    items: t.field({
      type: [ItemRef],
      resolve: (): Item[] => [
        { kind: 'Planned', userId: 1 },
        { kind: 'Raw', userId: 1 },
        { kind: 'Planned', userId: 1 },
        { kind: 'Raw', userId: 1 },
      ],
    }),
  }),
});

const schema = builder.toSchema();

async function run(source: string) {
  queries.length = 0;

  const result = await execute({ schema, document: parse(source), contextValue: {} });

  return { result, queries: queries.length };
}

describe('a planned parent beside one loaded without the query', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each([
    ['n(published: true)', 'n(published: false)', 149, 101],
    ['g(published: true)', 'g(published: false)', 149, 101],
    ['g(published: true)', 'g(published: true)', 149, 149],
  ])('reloads only the parent its query did not load: %s / %s', async (planned, raw, a, b) => {
    const mixed = await run(`{ items {
      ... on Planned { user { x: ${planned} } }
      ... on Raw { user { x: ${raw} } }
    } }`);
    const plannedOnly = await run(`{ items { ... on Planned { user { x: ${planned} } } } }`);
    const rawOnly = await run(`{ items { ... on Raw { user { x: ${raw} } } } }`);

    expect(mixed.result.errors).toBeUndefined();
    expect(mixed.result.data).toEqual({
      items: [{ user: { x: a } }, { user: { x: b } }, { user: { x: a } }, { user: { x: b } }],
    });
    // The planned parents resolve from their own query, as they do with no raw parent beside them.
    expect(plannedOnly.queries).toBe(2);
    // Each raw parent is fetched by its resolver and reloaded for the field.
    expect(rawOnly.queries).toBe(4);
    expect(mixed.queries).toBe(plannedOnly.queries + rawOnly.queries);
  });
});
