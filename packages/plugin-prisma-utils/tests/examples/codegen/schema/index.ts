import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { printSchema } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import { builder, prisma } from '../builder';
import {
  CommentFilter,
  CommentOrderBy,
  PostFilter,
  PostOrderBy,
  UserFilter,
  UserOrderBy,
  UserUniqueFilter,
} from './prisma-inputs';

builder.addScalarType('DateTime', DateTimeResolver, {});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: 'User',
      args: {
        where: t.arg({ type: UserUniqueFilter, required: true }),
      },
      nullable: true,
      resolve: (query, root, args, ctx) =>
        prisma.user.findUnique({
          ...query,
          where: args.where,
        }),
    }),
    users: t.prismaField({
      type: ['User'],
      args: {
        filter: t.arg({ type: UserFilter, required: true, defaultValue: {} }),
        orderBy: t.arg({
          type: UserOrderBy,
          required: true,
          defaultValue: {
            id: 'asc',
          },
        }),
      },
      resolve: (query, root, args, ctx) =>
        prisma.user.findMany({
          ...query,
          where: args.filter,
          orderBy: args.orderBy,
        }),
    }),
  }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: true }),
    email: t.exposeString('email'),
    posts: t.relation('posts', {
      args: {
        filter: t.arg({ type: PostFilter, required: true, defaultValue: {} }),
        orderBy: t.arg({
          type: PostOrderBy,
          required: true,
          defaultValue: {
            id: 'asc',
          },
        }),
      },
      query: (args) => ({
        where: args.filter,
        orderBy: args.orderBy,
      }),
    }),
    profile: t.relation('profile'),
  }),
});

builder.prismaObject('Profile', {
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.exposeString('bio', { nullable: true }),
    user: t.relation('user'),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content', { nullable: true }),
    published: t.exposeBoolean('published'),
    author: t.relation('author'),
    comments: t.relation('comments', {
      args: {
        filter: t.arg({ type: CommentFilter, required: true, defaultValue: {} }),
        orderBy: t.arg({
          type: CommentOrderBy,
          required: true,
          defaultValue: {
            id: 'asc',
          },
        }),
      },
      query: (args) => ({
        where: args.filter,
        orderBy: args.orderBy,
      }),
    }),
  }),
});

builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
    content: t.exposeString('content'),
    author: t.relation('author'),
    post: t.relation('post'),
  }),
});

export const schema = builder.toSchema();

// eslint-disable-next-line unicorn/prefer-module
writeFileSync(resolve(__dirname, '../schema.graphql'), printSchema(schema));

export default schema;
