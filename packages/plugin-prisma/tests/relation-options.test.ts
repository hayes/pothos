import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

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

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
  }),
});

builder.prismaObject('Profile', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    // A conditional filter. When the condition is false the relation query still carries a `where`
    // key holding `undefined`, which must compare equal to a selection without one.
    posts: t.relation('posts', {
      args: { published: t.arg.boolean() },
      query: (args) => ({ where: args.published ? { published: true } : undefined }),
    }),
    postTitles: t.stringList({
      select: { posts: { select: { title: true } } },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: 'User',
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) =>
        prisma.user.findUniqueOrThrow({ ...query, where: { id: args.id } }),
    }),
  }),
});

const schema = builder.toSchema();

describe('relation field options', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('treats a relation query with `where: undefined` as compatible with a plain selection', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user(id: 1) {
            posts {
              id
            }
            postTitles
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          include: { posts: { where: undefined } },
          where: { id: 1 },
        },
      },
    ]);
  });
});
