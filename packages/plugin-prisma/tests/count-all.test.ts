import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient, queryFromInfo } from '../src';
import { getDMMF } from '../src/util/get-client';
import { getRelationMap } from '../src/util/relation-map';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// `_count: true` (every list relation counted) in a type-level or field-level select is kept as
// is; only a filtered named count alongside it makes the counted relations explicit.
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

interface Counted {
  _count: { posts: number; comments: number };
}

const User = builder.prismaObject('User', {
  select: {
    id: true,
    _count: true,
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    // The plugin's shape for `_count: true` is not modelled; the runtime value is the count map.
    postCount: t.int({ resolve: (user) => (user as unknown as Counted)._count.posts }),
    commentCount: t.int({
      select: { _count: { select: { comments: true } } },
      resolve: (user) => (user as unknown as Counted)._count.comments,
    }),
    publishedPostCount: t.relationCount('posts', { where: { published: true } }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    // Adds a filtered count of its own next to the type's `_count: true`.
    userWithFilteredCount: t.field({
      type: User,
      resolve: (_root, _args, context, info) =>
        prisma.user.findUniqueOrThrow({
          ...queryFromInfo({
            context,
            info,
            select: { _count: { select: { posts: { where: { published: false } } } } },
          }),
          where: { id: 1 },
        }) as never,
    }),
  }),
});

const schema = builder.toSchema();

const listRelations = [...getRelationMap(getDMMF(builder)).get('User')!.listRelations];

describe('_count: true', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('keeps _count: true from type-level and field-level selects', async () => {
    const { _count } = await prisma.user.findUniqueOrThrow({
      where: { id: 1 },
      select: { _count: true },
    });
    queries.length = 0;

    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            id
            postCount
            commentCount
          }
        }
      `,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: { id: '1', postCount: _count.posts, commentCount: _count.comments },
    });
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: { select: { id: true, _count: true }, where: { id: 1 } },
      },
    ]);
  });

  it('loads a filtered count on its own rather than merging it into _count: true', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          user {
            postCount
            publishedPostCount
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
        args: { select: { id: true, _count: true }, where: { id: 1 } },
      },
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          select: { id: true, _count: { select: { posts: { where: { published: true } } } } },
          where: { id: 1 },
        },
      },
    ]);
  });

  it('spells out the counted relations when a filtered count is selected alongside', async () => {
    const result = await execute({
      schema,
      document: gql`
        query {
          userWithFilteredCount {
            postCount
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
          select: {
            id: true,
            _count: {
              select: {
                ...Object.fromEntries(listRelations.map((name) => [name, true])),
                posts: { where: { published: false } },
              },
            },
          },
          where: { id: 1 },
        },
      },
    ]);
  });
});
