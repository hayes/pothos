import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { rebuildResolverPaths } from '@pothos/test-utils';
import { execute, parse } from 'graphql';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// graphql-jit hands every resolver a path it builds afresh, sharing no link with any other
// resolver's and without a `typename`, and no `getAbortSignal`. Run that way, a document loads with the same queries.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { rebuildPaths?: boolean };
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts', { query: { take: 3, orderBy: { id: 'asc' } } }),
    postsConnection: t.relatedConnection('posts', { cursor: 'id' }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author'),
    comments: t.relation('comments', { query: { take: 2, orderBy: { id: 'asc' } } }),
  }),
});

builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author'),
  }),
});

builder.queryType({
  fields: (t) => ({
    users: t.prismaField({
      type: ['User'],
      resolve: (query) => prisma.user.findMany({ ...query, take: 10, orderBy: { id: 'asc' } }),
    }),
    // Loaded outside the plan, so every row falls back to the model loader.
    rawUsers: t.prismaField({
      type: ['User'],
      resolve: () => prisma.user.findMany({ take: 3, orderBy: { id: 'asc' } }),
    }),
  }),
});

const schema = builder.toSchema();

rebuildResolverPaths(schema, (context: { rebuildPaths?: boolean }) => !!context.rebuildPaths);

async function run(source: string, rebuildPaths: boolean) {
  queries.length = 0;

  const result = await execute({ schema, document: parse(source), contextValue: { rebuildPaths } });
  const issued = [...queries];

  queries.length = 0;

  return { result, queries: issued };
}

describe('an executor that builds a new path for each resolver', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each([
    '{ users { id posts { id author { id posts { id comments { id author { id } } } } } } }',
    '{ users { postsConnection(first: 2) { edges { node { id author { id posts { id } } comments { id } } } } } }',
  ])('loads a planned document in one query: %s', async (source) => {
    const expected = await run(source, false);
    const actual = await run(source, true);

    expect(expected.result.errors).toBeUndefined();
    expect(expected.queries).toHaveLength(1);
    expect(actual.queries).toEqual(expected.queries);
    expect(actual.result).toEqual(expected.result);
  });

  it('loads what is beneath a reloaded row with its reload', async () => {
    const source = '{ rawUsers { id posts { id author { id posts { id comments { id } } } } } }';
    const expected = await run(source, false);
    const actual = await run(source, true);

    expect(expected.result.errors).toBeUndefined();
    // The list, and a reload of each of its 3 rows that loads everything beneath the row.
    expect(expected.queries).toHaveLength(4);
    expect(actual.queries).toEqual(expected.queries);
    expect(actual.result).toEqual(expected.result);
  });
});
