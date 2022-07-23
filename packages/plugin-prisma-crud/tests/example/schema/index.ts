import { InputRef } from '@pothos/core';
import { Prisma } from '../../client';
import builder from '../builder';
import { db } from '../db';

const StringFilter = builder.prismaFilter('String', {
  ops: ['contains', 'equals', 'startsWith', 'not', 'equals'],
});
const IDFilter = builder.prismaFilter('String', {
  ops: ['equals', 'not'],
});

const StringListFilter = builder.prismaListFilter(StringFilter, {
  ops: ['every', 'some', 'none'],
});

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

const ProfileOrderBy: InputRef<Prisma.ProfileOrderByWithRelationInput> = builder.prismaOrderBy(
  'Profile',
  {
    fields: {
      bio: true,
      user: () => UserOrderBy,
    },
  },
);

const UserOrderBy = builder.prismaOrderBy('User', {
  fields: {
    name: true,
    profile: ProfileOrderBy,
  },
});

const PostOrderBy = builder.prismaOrderBy('Post', {
  fields: {
    id: true,
    title: true,
    createdAt: true,
    author: UserOrderBy,
  },
});

const CommentWhere = builder.prismaWhere('Comment', {
  fields: {
    createdAt: true,
  },
});

const UserWhere = builder.prismaWhere('User', {
  fields: {
    id: 'equals',
  },
});

builder.prismaWhere('Post', {
  fields: {
    id: IDFilter,
    title: 'String',
    createdAt: {},
    author: UserWhere,
    comments: {
      some: CommentWhere,
    },
  },
});

db.post.fin;

export default builder.toSchema({});
