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
    profile: t.relation('profile', {
      nullable: true,
      args: { label: t.arg.string() },
      onNull: (user, args, context, info) =>
        new Error(
          `no profile for user ${user.id} (${args.label}) via ${info.parentType.name}.${info.fieldName} for viewer ${context.user.id}`,
        ),
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

  it('passes args, context and info to onNull', async () => {
    const userWithoutProfile = await prisma.user.findFirstOrThrow({
      where: { profile: null },
      select: { id: true },
    });

    const result = await execute({
      schema,
      document: gql`
        query ($id: Int!) {
          user(id: $id) {
            profile(label: "primary") {
              id
            }
          }
        }
      `,
      variableValues: { id: userWithoutProfile.id },
      contextValue: { user: { id: 42 } },
    });

    expect(result.data).toEqual({ user: { profile: null } });
    expect(result.errors?.map((error) => error.message)).toEqual([
      `no profile for user ${userWithoutProfile.id} (primary) via User.profile for viewer 42`,
    ]);
  });
});
