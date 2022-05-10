import builder from '../builder';
import { db } from '../db';

builder.prismaScalarFilter('DateTime');

builder.prismaOrderBy('Post', {
  fields: {
    title: true,
    createdAt: true,
    author: {
      name: true,
    },
    comments: {
      _count: true,
    },
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
    id: { alias: 'ID', filters: 'equals' },
    title: {
      alias: 'Title',
      filters: {
        gt: true,
        equals: true,
      },
    },
    createdAt: {},
    author: UserWhere,
    comments: {
      some: CommentWhere,
    },
  },
});

export default builder.toSchema({});
