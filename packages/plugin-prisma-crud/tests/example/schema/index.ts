import { InputRef } from '@pothos/core';
import { Prisma } from '../../client';
import builder from '../builder';
import { db } from '../db';

const StringFilter = builder.prismaFilter('String', {
  ops: ['contains', 'equals', 'startsWith', 'not', 'equals'],
});
export const IDFilter = builder.prismaFilter('Int', {
  ops: ['equals', 'not'],
});

const StringListFilter = builder.prismaListFilter(StringFilter, {
  ops: ['every', 'some', 'none'],
});

builder.scalarType('DateTime', {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => (typeof value === 'number' ? new Date(value) : new Date(String(value))),
});

builder.queryType({});

builder.queryField('post', (t) =>
  t.prismaField({
    type: 'Post',
    nullable: true,
    args: {
      title: t.arg({
        type: StringFilter,
      }),
      list: t.arg({ type: StringListFilter }),
    },
    resolve: (query, _, args) =>
      db.post.findFirst({
        where: {
          title: args.title ?? undefined,
          comments: {},
        },
      }),
  }),
);

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const ProfileOrderBy: InputRef<Prisma.ProfileOrderByWithRelationInput> = builder.prismaOrderBy(
  'Profile',
  {
    fields: () => ({
      bio: true,
      user: UserOrderBy,
    }),
  },
);

const UserOrderBy = builder.prismaOrderBy('User', {
  fields: {
    name: true,
    profile: ProfileOrderBy,
  },
});

export const PostOrderBy = builder.prismaOrderBy('Post', {
  fields: {
    id: true,
    title: true,
    createdAt: true,
    author: UserOrderBy,
  },
});

const CommentWhere = builder.prismaWhere('Comment', {
  fields: {
    createdAt: 'DateTime',
  },
});

const UserWhere = builder.prismaWhere('User', {
  fields: {
    id: IDFilter,
  },
});

builder.prismaWhere('Post', {
  fields: () => ({
    id: IDFilter,
    title: 'String',
    createdAt: 'DateTime',
    author: UserWhere,
    comments: builder.prismaListFilter(CommentWhere, { ops: ['some'] }),
    authorId: () => ({ type: IDFilter, description: 'filter by author id' }),
  }),
});

export default builder.toSchema({});
