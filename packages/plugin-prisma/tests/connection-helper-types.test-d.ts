import SchemaBuilder from '@pothos/core';
import { expectTypeOf, it } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient, prismaConnectionHelpers } from '../src';
import type { Prisma } from './client/client';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypesFromClient<typeof prisma> }>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => null as never,
    dmmf: getDatamodel(),
  },
});

const Comment = builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const commentHelpers = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
  query: { orderBy: { content: 'asc' } },
});

builder.prismaObject('User', {
  fields: (t) => ({
    comments: t.connection({
      type: Comment,
      select: (args, ctx, nestedSelection) => ({
        comments: commentHelpers.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (user, args, ctx) => commentHelpers.resolve(user.comments, args, ctx),
    }),
  }),
});

// The cursor is appended to an order that is not unique, so the built `orderBy` can be a list.
it('types the built orderBy as an ordering or a list of them', () => {
  const query = commentHelpers.getQuery({ first: 2 }, {}, () => true);

  expectTypeOf(query.orderBy).toEqualTypeOf<
    Prisma.CommentOrderByWithRelationInput | Prisma.CommentOrderByWithRelationInput[] | undefined
  >();

  // @ts-expect-error a list of orderings has no `content`
  query.orderBy?.content;
});

it('spreads the built query into findMany', () => {
  const listComments = () =>
    prisma.comment.findMany({ ...commentHelpers.getQuery({ first: 2 }, {}, () => true) });

  expectTypeOf(listComments).returns.resolves.toExtend<{ id: number }[]>();
});

// A function's literals widen to `string` (the helper's model is a type parameter while the
// function is checked), so the function form needs `as const`.
it("accepts an ordering or a list of them in the helper's query", () => {
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    query: { orderBy: { content: 'asc' } },
  });
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    query: { orderBy: [{ content: 'asc' }, { createdAt: 'desc' }] },
  });
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    query: () => ({ orderBy: { content: 'asc' as const } }),
  });
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    query: () => ({ orderBy: [{ content: 'asc' as const }, { createdAt: 'desc' as const }] }),
  });
});

it("rejects an unknown field or direction in the helper's query", () => {
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    query: {
      orderBy: {
        // @ts-expect-error not a Comment field
        title: 'asc',
      },
    },
  });
  // As in prisma's own `orderBy`, a bad direction in a single ordering is reported on `orderBy`:
  // the ordering could be either member of the union.
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    query: {
      // @ts-expect-error not a sort direction
      orderBy: {
        content: 'up',
      },
    },
  });
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    query: {
      orderBy: [
        {
          // @ts-expect-error not a Comment field
          title: 'asc',
        },
      ],
    },
  });
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    query: {
      orderBy: [
        { content: 'asc' },
        {
          // @ts-expect-error not a sort direction
          createdAt: 'up',
        },
      ],
    },
  });
  // A function's return is checked as a whole rather than property by property, so the error is
  // reported on `query`, and an unknown field beside a known one is not caught.
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    // @ts-expect-error not a sort direction
    query: () => ({ orderBy: { content: 'up' as const } }),
  });
  prismaConnectionHelpers(builder, 'Comment', {
    cursor: 'id',
    // @ts-expect-error not a Comment field
    query: () => ({ orderBy: [{ title: 'asc' as const }] }),
  });
});
