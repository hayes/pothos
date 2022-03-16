import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';
import PrismaPlugin from '@pothos/plugin-prisma';
import type PrismaTypes from '../../prisma/generated';
import { db } from '../db';

export const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [DirectivesPlugin, PrismaPlugin, FederationPlugin],
  prisma: {
    client: db,
  },
  useGraphQLToolsUnorderedDirectives: true,
});

const User = builder
  .externalRef('User', builder.selection<{ id: string | number }>('id'))
  .implement({
    externalFields: (t) => ({
      id: t.id(),
    }),
    fields: (t) => ({
      comments: t.prismaField({
        type: ['Comment'],
        resolve: (query, user) =>
          db.user
            .findUnique({ where: { id: Number.parseInt(String(user.id), 10) } })
            .comments({ orderBy: { updatedAt: 'desc' }, ...query }),
      }),
    }),
  });

const Post = builder
  .externalRef('Post', builder.selection<{ id: string | number }>('id'))
  .implement({
    externalFields: (t) => ({
      id: t.id(),
    }),
    fields: (t) => ({
      comments: t.prismaField({
        type: ['Comment'],
        resolve: (query, post) =>
          db.post
            .findUnique({ where: { id: Number.parseInt(String(post.id), 10) } })
            .comments({ orderBy: { updatedAt: 'desc' }, ...query }),
      }),
    }),
  });

const Comment = builder.prismaObject('Comment', {
  findUnique: ({ id }) => ({ id: Number.parseInt(String(id), 10) }),
  fields: (t) => ({
    id: t.exposeID('id'),
    comment: t.exposeString('comment'),
    author: t.field({
      type: User,
      resolve: (comment) => ({ id: comment.authorId }),
    }),
    post: t.field({
      type: Post,
      resolve: (comment) => ({ id: comment.postId }),
    }),
  }),
});

builder.asEntity(Comment, {
  key: builder.selection<{ id: number | string }>('id'),
  resolveReference: ({ id }) =>
    db.comment.findFirst({ where: { id: Number.parseInt(String(id), 10) } }),
});

builder.queryType({
  fields: (t) => ({
    comment: t.prismaField({
      type: 'Comment',
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (query, root, { id }) =>
        db.comment.findUnique({
          ...query,
          where: { id: Number.parseInt(String(id), 10) },
          rejectOnNotFound: true,
        }),
    }),
  }),
});

export const schema = builder.toSubGraphSchema({});
