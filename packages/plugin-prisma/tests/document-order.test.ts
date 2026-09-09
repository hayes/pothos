import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Two selections of the same relation with different arguments cannot share one query. The one
// the document lists first is planned into the parent's query, whether it sits in a fragment or
// is a direct field; the other loads on its own.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
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
    posts: t.relation('posts', {
      args: {
        take: t.arg.int({ required: true }),
      },
      query: (args) => ({
        take: args.take,
        orderBy: { id: 'asc' },
      }),
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

/** The user row loaded with `posts(take)`: the planned query, or the fallback for the other alias. */
const userQuery = (take: number) => ({
  action: 'findUniqueOrThrow',
  model: 'User',
  args: {
    include: { posts: { take, orderBy: { id: 'asc' } } },
    where: { id: 1 },
  },
});

describe('selections are walked in document order', () => {
  let posts: { id: number }[];

  beforeAll(async () => {
    posts = await prisma.post.findMany({ where: { authorId: 1 }, orderBy: { id: 'asc' }, take: 2 });
    queries.length = 0;
  });

  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const expectedData = () => ({
    user: {
      first: [{ id: String(posts[0].id) }],
      second: posts.map((post) => ({ id: String(post.id) })),
    },
  });

  it('plans the relation from a fragment listed before a field', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            ... on User {
              first: posts(take: 1) {
                id
              }
            }
            second: posts(take: 2) {
              id
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual(expectedData());
    // `first` is planned; `second` loads on its own.
    expect(queries).toEqual([userQuery(1), userQuery(2)]);
  });

  it('plans the relation from a field listed before a fragment', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            second: posts(take: 2) {
              id
            }
            ... on User {
              first: posts(take: 1) {
                id
              }
            }
          }
        }
      `,
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual(expectedData());
    // `second` is planned; `first` loads on its own.
    expect(queries).toEqual([userQuery(2), userQuery(1)]);
  });
});
