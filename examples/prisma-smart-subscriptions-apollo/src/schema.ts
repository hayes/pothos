import { printSchema } from 'graphql';
import { builder } from './builder';

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

builder.queryFields((t) => ({
  countManyUser: t.field({
    type: 'Int',
    smartSubscription: true,
    subscribe: (subscriptions, root, args, ctx, info) =>
      void subscriptions.register('dbUpdatedUser'),
    resolve: (root, args, ctx, info) => ctx.db.user.count(),
  }),
}));

builder.queryType();
builder.subscriptionType();
builder.mutationType({
  fields: (t) => ({
    createOneUser: t.prismaField({
      type: 'User',
      args: {
        firstName: t.arg.string({ required: true }),
        lastName: t.arg.string({ required: true }),
      },
      resolve: (include, root, args, ctx, info) =>
        ctx.db.user.create({
          data: args,
          ...include,
        }),
    }),
  }),
});

export const schema = builder.toSchema();

console.log(printSchema(schema));
