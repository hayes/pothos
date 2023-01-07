import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { printSchema } from 'graphql';
import { Category } from '../../../client';
import builder, { prisma } from '../builder';
import { PrismaCrudGenerator } from '../generator';

const generator = new PrismaCrudGenerator(builder);

builder.scalarType('DateTime', {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => (typeof value === 'number' ? new Date(value) : new Date(String(value))),
});

builder.queryType({
  fields: (t) => ({
    post: t.prismaField({
      type: 'Post',
      nullable: true,
      args: { where: t.arg({ type: generator.getWhereUnique('Post'), required: true }) },
      resolve: (query, _, args) =>
        prisma.post.findUnique({
          ...query,
          where: args.where,
        }),
    }),
    posts: t.prismaField({
      type: ['Post'],
      args: generator.findManyArgs('Post'),
      resolve: (query, _, args) =>
        prisma.post.findMany({
          ...query,
          where: args.filter ?? undefined,
          orderBy: args.orderBy ?? undefined,
          take: 3,
        }),
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createUser: t.prismaField({
      type: 'User',
      args: { input: t.arg({ type: generator.getCreateInput('User'), required: true }) },
      resolve: (query, _, args) =>
        prisma.user.create({
          ...query,
          data: {
            ...args.input,
          },
        }),
    }),
    updateUser: t.prismaField({
      type: 'User',
      args: {
        where: t.arg({ type: generator.getWhereUnique('User'), required: true }),
        data: t.arg({ type: generator.getUpdateInput('User'), required: true }),
      },
      resolve: (query, _, args) =>
        prisma.user.update({
          ...query,
          where: {
            ...args.where,
          },
          data: {
            ...args.data,
          },
        }),
    }),
    createPost: t.prismaField({
      type: 'Post',
      args: { input: t.arg({ type: generator.getCreateInput('Post'), required: true }) },
      resolve: (query, _, args) =>
        prisma.post.create({
          ...query,
          data: {
            ...args.input,
          },
        }),
    }),
    updatePost: t.prismaField({
      type: 'Post',
      args: {
        where: t.arg({ type: generator.getWhereUnique('Post'), required: true }),
        data: t.arg({ type: generator.getUpdateInput('Post'), required: true }),
      },
      resolve: (query, _, args) =>
        prisma.post.update({
          ...query,
          where: {
            ...args.where,
          },
          data: {
            ...args.data,
          },
        }),
    }),
    updateManyPosts: t.int({
      args: {
        where: t.arg({ type: generator.getWhere('Post') }),
        data: t.arg({ type: generator.getUpdateInput('Post'), required: true }),
      },
      resolve: async (_, args) => {
        const result = await prisma.post.updateMany({
          where: args.where ?? undefined,
          data: args.data,
        });

        return result.count;
      },
    }),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    tags: t.exposeStringList('tags'),
    categories: t.expose('categories', { type: [Category] }),
    author: t.relation('author'),
    comments: t.relation('comments', {
      args: generator.findManyArgs('Comment'),
      query: (args) => ({
        where: args.filter ?? undefined,
        orderBy: args.orderBy ?? undefined,
        take: 2,
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

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: true }),
    email: t.exposeString('email'),
    comments: t.relation('comments'),
    posts: t.relation('posts', {
      args: generator.findManyArgs('Post'),
      query: (args) => ({
        where: args.filter ?? undefined,
        orderBy: args.orderBy ?? undefined,
        take: 2,
      }),
    }),
  }),
});

export const schema = builder.toSchema();

// eslint-disable-next-line unicorn/prefer-module
writeFileSync(resolve(__dirname, '../schema.graphql'), printSchema(schema));

export default schema;
