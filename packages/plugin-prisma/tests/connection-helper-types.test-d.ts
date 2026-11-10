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
  const direction: unknown = query.orderBy?.content;

  expectTypeOf(direction).toBeUnknown();
});

it('spreads the built query into findMany', () => {
  const listComments = () =>
    prisma.comment.findMany({ ...commentHelpers.getQuery({ first: 2 }, {}, () => true) });

  expectTypeOf(listComments).returns.resolves.toMatchTypeOf<{ id: number }[]>();
});
