import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient, queryFromInfo } from '../src';
import type { User as UserRow } from './client/client.js';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// `queryFromInfo` with `path`/`paths` that select nothing: the caller gets back its own selection,
// or an empty query it can pass straight to prisma.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { user: { id: number } };
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
    posts: t.relation('posts'),
  }),
});

const SelectUser = builder.prismaObject('User', {
  variant: 'SelectUser',
  select: {
    email: true,
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

interface EntryShape {
  kind: string;
  user: UserRow;
}

const Entry = builder.objectRef<EntryShape>('Entry').implement({
  fields: (t) => ({
    kind: t.exposeString('kind'),
    user: t.field({ type: User, resolve: (entry) => entry.user }),
    selectUser: t.field({ type: SelectUser, resolve: (entry) => entry.user }),
  }),
});

const plannedQueries: unknown[] = [];

type Info = Parameters<typeof queryFromInfo>[0]['info'];

async function resolveEntry(query: object): Promise<EntryShape> {
  plannedQueries.push(query);

  return {
    kind: 'entry',
    user: await prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
  };
}

builder.queryType({
  fields: (t) => ({
    selectMode: t.field({
      type: Entry,
      resolve: (_root, _args, context, info: Info) =>
        resolveEntry(
          queryFromInfo({ context, info, typeName: 'SelectUser', path: ['selectUser'] }),
        ),
    }),
    selectModeWithInitial: t.field({
      type: Entry,
      resolve: (_root, _args, context, info: Info) =>
        resolveEntry(
          queryFromInfo({
            context,
            info,
            typeName: 'SelectUser',
            path: ['selectUser'],
            select: { name: true },
          }),
        ),
    }),
    includeMode: t.field({
      type: Entry,
      resolve: (_root, _args, context, info: Info) =>
        resolveEntry(queryFromInfo({ context, info, typeName: 'User', path: ['user'] })),
    }),
    includeModeWithInitial: t.field({
      type: Entry,
      resolve: (_root, _args, context, info: Info) =>
        resolveEntry(
          queryFromInfo({
            context,
            info,
            typeName: 'User',
            path: ['user'],
            include: { posts: true },
          }),
        ),
    }),
  }),
});

const schema = builder.toSchema();

describe('queryFromInfo with paths that select nothing', () => {
  afterEach(() => {
    queries.length = 0;
    plannedQueries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each([
    ['selectMode', {}],
    ['selectModeWithInitial', { select: { name: true } }],
    ['includeMode', {}],
    ['includeModeWithInitial', { include: { posts: true } }],
  ])('%s returns the initial selection or an empty query', async (field, expected) => {
    const result = await execute({
      schema,
      document: gql`
        query {
          entry: ${field} {
            kind
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ entry: { kind: 'entry' } });
    expect(plannedQueries).toEqual([expected]);
    expect(queries).toEqual([
      { action: 'findUniqueOrThrow', model: 'User', args: { ...expected, where: { id: 1 } } },
    ]);
  });
});
