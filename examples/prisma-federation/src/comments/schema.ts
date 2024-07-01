import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';
import PrismaPlugin from '@pothos/plugin-prisma';
import type PrismaTypes from '../../prisma/generated';
import { db } from '../db';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Scalars: {
    ID: { Input: string; Output: number | string };
  };
}>({
  plugins: [DirectivesPlugin, PrismaPlugin, FederationPlugin],
  prisma: {
    client: db,
  },
  relay: {},
});

const User = builder.externalRef('User', builder.selection<{ id: string }>('id')).implement({
  externalFields: (t) => ({
    id: t.id(),
  }),
  fields: (t) => ({
    comments: t.prismaField({
      type: ['Comment'],
      resolve: (query, user) =>
        db.user
          .findUniqueOrThrow({ where: { id: Number.parseInt(user.id, 10) } })
          .comments({ orderBy: { updatedAt: 'desc' }, ...query }),
    }),
  }),
});

const Post = builder.externalRef('Post', builder.selection<{ id: string }>('id')).implement({
  externalFields: (t) => ({
    id: t.id(),
  }),
  fields: (t) => ({
    comments: t.prismaField({
      type: ['Comment'],
      resolve: (query, post) =>
        db.post
          .findUniqueOrThrow({ where: { id: Number.parseInt(post.id, 10) } })
          .comments({ orderBy: { updatedAt: 'desc' }, ...query }),
    }),
  }),
});

const Comment = builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
    comment: t.exposeString('comment'),
    author: t.field({
      type: User,
      resolve: (comment) => ({ id: String(comment.authorId) }),
    }),
    post: t.field({
      type: Post,
      resolve: (comment) => ({ id: String(comment.id) }),
    }),
  }),
});

builder.asEntity(Comment, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: ({ id }) => db.comment.findFirst({ where: { id: Number.parseInt(id, 10) } }),
});

builder.queryType({
  fields: (t) => ({
    comment: t.prismaField({
      type: 'Comment',
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (query, root, { id }) =>
        db.comment.findUniqueOrThrow({
          ...query,
          where: { id: Number.parseInt(id, 10) },
        }),
    }),
  }),
});

export const schema = builder.toSubGraphSchema({});
