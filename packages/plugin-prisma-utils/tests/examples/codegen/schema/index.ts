import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { printSchema } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import { Category } from '../../../client';
import { builder, prisma } from '../builder';
import {
  CommentFilter,
  CommentOrderBy,
  PostCreate,
  PostFilter,
  PostOrderBy,
  PostUniqueFilter,
  PostUpdate,
  UserCreate,
  UserFilter,
  UserOrderBy,
  UserUniqueFilter,
  UserUpdate,
} from './prisma-inputs';

builder.addScalarType('DateTime', DateTimeResolver);

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: 'User',
      args: {
        where: t.arg({ type: UserUniqueFilter, required: true }),
      },
      nullable: true,
      resolve: (query, _root, args) =>
        prisma.user.findUnique(
          query({
            where: args.where,
          }),
        ),
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
      resolve: (query, _root, args) =>
        prisma.user.findMany(
          query({
            where: args.filter,
            orderBy: args.orderBy,
          }),
        ),
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
    tags: t.exposeStringList('tags'),
    categories: t.expose('categories', { type: [Category] }),
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

builder.mutationType({
  fields: (t) => ({
    createUser: t.prismaField({
      type: 'User',
      args: {
        data: t.arg({ type: UserCreate, required: true }),
      },
      resolve: (query, _root, args, _ctx) =>
        prisma.user.create(
          query({
            data: args.data,
          }),
        ),
    }),
    updateUser: t.prismaField({
      type: 'User',
      args: {
        where: t.arg({ type: UserUniqueFilter, required: true }),
        data: t.arg({ type: UserUpdate, required: true }),
      },
      resolve: (query, _root, args, _ctx) =>
        prisma.user.update(
          query({
            where: args.where,
            data: args.data,
          }),
        ),
    }),
    deleteUser: t.prismaField({
      type: 'User',
      args: {
        where: t.arg({ type: UserUniqueFilter, required: true }),
      },
      resolve: (query, _root, args, _ctx) =>
        prisma.user.delete(
          query({
            where: args.where,
          }),
        ),
    }),
    createPost: t.prismaField({
      type: 'Post',
      args: {
        data: t.arg({ type: PostCreate, required: true }),
      },
      resolve: (query, _root, args, _ctx) =>
        prisma.post.create(
          query({
            data: args.data,
          }),
        ),
    }),
    updatePost: t.prismaField({
      type: 'Post',
      args: {
        where: t.arg({ type: PostUniqueFilter, required: true }),
        data: t.arg({ type: PostUpdate, required: true }),
      },
      resolve: (query, _root, args, _ctx) =>
        prisma.post.update(
          query({
            where: args.where,
            data: args.data,
          }),
        ),
    }),
    deletePost: t.prismaField({
      type: 'Post',
      args: {
        where: t.arg({ type: PostUniqueFilter, required: true }),
      },
      resolve: (query, _root, args, _ctx) =>
        prisma.post.delete(
          query({
            where: args.where,
          }),
        ),
    }),
    deleteManyPosts: t.boolean({
      args: {
        where: t.arg({ type: PostFilter, required: true }),
      },
      resolve: async (_root, args) => {
        await prisma.post.deleteMany({
          where: args.where,
        });

        return false;
      },
    }),
  }),
});

export const schema = builder.toSchema();

writeFileSync(resolve(__dirname, '../schema.graphql'), printSchema(schema));

export default schema;
