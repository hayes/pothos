import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Loader mappings are keyed by the full path from the planned field, so a relation selected
// under both `nodes` and `edges.node` of a connection is answered from the loaded rows in both
// places instead of the second path falling back to a query of its own.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { user: { id: number } };
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
  relay: {
    nodesOnConnection: true,
  },
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: true }),
    postsConnection: t.relatedConnection('posts', { cursor: 'id' }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author'),
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

describe('loader mappings keyed by path', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('answers a relation selected under both nodes and edges.node from one query', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postsConnection(first: 2) {
              nodes {
                id
                author {
                  name
                }
              }
              edges {
                node {
                  id
                  writer: author {
                    id
                  }
                }
              }
            }
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();

    const connection = (result.data as { user: { postsConnection: { nodes: unknown[] } } }).user
      .postsConnection;

    expect(connection.nodes).toHaveLength(2);
    expect(connection).toEqual({
      nodes: expect.arrayContaining([
        { id: expect.any(String), author: { name: expect.any(String) } },
      ]),
      edges: expect.arrayContaining([
        { node: { id: expect.any(String), writer: { id: expect.any(String) } } },
      ]),
    });
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          include: { posts: { include: { author: true }, skip: 0, take: 3 } },
          where: { id: 1 },
        },
      },
    ]);
  });
});
