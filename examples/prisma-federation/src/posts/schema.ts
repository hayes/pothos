import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';
import PrismaPlugin from '@pothos/plugin-prisma';
import type PrismaTypes from '../../prisma/generated';
import { db } from '../db';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    ID: { Input: string; Output: string | number };
  };
}>({
  plugins: [DirectivesPlugin, PrismaPlugin, FederationPlugin],
  prisma: {
    client: db,
  },
});

const User = builder.externalRef('User', builder.selection<{ id: string }>('id')).implement({
  externalFields: (t) => ({
    id: t.id(),
  }),
  fields: (t) => ({
    posts: t.prismaField({
      type: ['Post'],
      resolve: (query, user) =>
        db.user
          .findUnique({ where: { id: Number.parseInt(user.id, 10) } })
          .posts({ orderBy: { updatedAt: 'desc' }, ...query }),
    }),
  }),
});

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    author: t.field({
      type: User,
      resolve: (post) => ({ id: String(post.authorId) }),
    }),
  }),
});

builder.asEntity(Post, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: ({ id }) => db.post.findFirst({ where: { id: Number.parseInt(id, 10) } }),
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
        db.post.findUnique({
          ...query,
          where: { id: Number.parseInt(args.id, 10) },
        }),
    }),
    posts: t.prismaField({
      type: ['Post'],
      args: {
        take: t.arg.int(),
        skip: t.arg.int(),
      },
      resolve: (query, root, args) =>
        db.post.findMany({
          ...query,
          take: args.take ?? DEFAULT_PAGE_SIZE,
          skip: args.skip ?? 0,
        }),
    }),
  }),
});

export const schema = builder.toSubGraphSchema({});
