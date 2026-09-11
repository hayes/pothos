import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient, queryFromInfo } from '../src';
import type { User as UserRow } from './client/client.js';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// `queryFromInfo` over a subtree with an async selection in it. Whether one is there depends on
// the document, not on the call, so the default refuses the promise it cannot declare and
// `awaitSelections` is how a caller asks for it.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { user: { id: number } };
  AsyncSelections: true;
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts'),
    postTitles: t.stringList({
      select: async () => ({ posts: { select: { title: true }, take: 1 } }),
      resolve: (user) => user.posts.map((post) => post.title),
    }),
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
    entry: t.field({
      type: Entry,
      resolve: (_root, _args, context, info: Info) =>
        resolveEntry(queryFromInfo({ context, info, typeName: 'User', path: ['user'] })),
    }),
    awaitedEntry: t.field({
      type: Entry,
      resolve: async (_root, _args, context, info: Info) =>
        resolveEntry(
          await queryFromInfo({
            context,
            info,
            typeName: 'User',
            path: ['user'],
            awaitSelections: true,
          }),
        ),
    }),
  }),
});

const schema = builder.toSchema();

const withAsyncSelection = (field: string) => gql`
  query {
    entry: ${field} {
      user {
        id
        postTitles
      }
    }
  }
`;

describe('queryFromInfo with an async selection beneath the field', () => {
  afterEach(() => {
    queries.length = 0;
    plannedQueries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('throws rather than returning a promise the caller did not ask for', async () => {
    const result = await execute({
      schema,
      document: withAsyncSelection('entry'),
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors?.[0].message).toBe(
      'queryFromInfo could not build the query for Query.entry synchronously, because a selection beneath it is async. Pass awaitSelections: true and await the result.',
    );
    expect(plannedQueries).toEqual([]);
    expect(queries).toEqual([]);
  });

  it('builds the query with awaitSelections', async () => {
    const result = await execute({
      schema,
      document: withAsyncSelection('awaitedEntry'),
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(plannedQueries).toEqual([{ include: { posts: { select: { title: true }, take: 1 } } }]);
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          include: { posts: { select: { title: true }, take: 1 } },
          where: { id: 1 },
        },
      },
    ]);
  });

  it('stays synchronous when nothing beneath the field is async', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          entry {
            user {
              id
              posts {
                id
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(plannedQueries).toEqual([{ include: { posts: true } }]);
  });
});
