import { builder } from './builder';
import { db } from './db';

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    fullName: t.string({
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    posts: t.relation('posts'),
    comments: t.relation('comments'),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    author: t.relation('author'),
    comments: t.relation('comments'),
  }),
});

builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
    comment: t.exposeString('comment'),
    author: t.relation('author'),
    post: t.relation('post'),
  }),
});

const DEFAULT_PAGE_SIZE = 10;

builder.queryType({
  fields: (t) => ({
    post: t.prismaField({
      type: 'Post',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (query, root, args) =>
        db.post.findUnique(query({
          where: { id: Number.parseInt(String(args.id), 10) },
        })),
    }),
    posts: t.prismaField({
      type: ['Post'],
      args: {
        take: t.arg.int(),
        skip: t.arg.int(),
      },
      resolve: (query, _root, args) =>
        db.post.findMany(query({
          take: args.take ?? DEFAULT_PAGE_SIZE,
          skip: args.skip ?? 0,
        })),
    }),
    user: t.prismaField({
      type: 'User',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (query, root, args) =>
        db.user.findUnique(query({
          where: { id: Number.parseInt(String(args.id), 10) },
        })),
    }),
  }),
});

export const schema = builder.toSchema();
