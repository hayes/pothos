import { printSchema } from 'graphql';
import { builder } from './builder';
import { db } from './db';
import {
  MutationType,
  type PubSubEvent,
  type PubSubPostEvent,
  type PubSubUserEvent,
} from './pubsub';

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
      resolve: (query, _root, args) =>
        db.post.findUnique({
          ...query,
          where: { id: Number.parseInt(String(args.id), 10) },
        }),
    }),
    posts: t.prismaField({
      type: ['Post'],
      args: {
        take: t.arg.int(),
        skip: t.arg.int(),
      },
      resolve: (query, _root, args) =>
        db.post.findMany({
          ...query,
          take: args.take ?? DEFAULT_PAGE_SIZE,
          skip: args.skip ?? 0,
        }),
    }),
    user: t.prismaField({
      type: 'User',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (query, _root, args) =>
        db.user.findUnique({
          ...query,
          where: { id: Number.parseInt(String(args.id), 10) },
        }),
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createPost: t.prismaField({
      type: 'Post',
      args: {
        title: t.arg.string({ required: true }),
        content: t.arg.string({ required: true }),
        authorId: t.arg.id({ required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const post = await db.post.create({
          ...query,
          data: {
            title: args.title,
            content: args.content,
            author: {
              connect: { id: Number.parseInt(String(args.authorId), 10) },
            },
          },
        });

        ctx.pubsub.publish('post', post.id, {
          mutationType: MutationType.CREATED,
          post,
        });

        return post;
      },
    }),
    updatePost: t.prismaField({
      type: 'Post',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
        title: t.arg.string(),
        content: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const post = await db.post.update({
          ...query,
          where: { id: Number.parseInt(String(args.id), 10) },
          data: {
            title: args.title ?? undefined,
            content: args.content ?? undefined,
          },
        });

        ctx.pubsub.publish('post', post.id, {
          mutationType: MutationType.UPDATED,
          post,
        });

        return post;
      },
    }),
    deletePost: t.prismaField({
      type: 'Post',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const post = await db.post.delete({
          ...query,
          where: { id: Number.parseInt(String(args.id), 10) },
        });

        ctx.pubsub.publish('post', post.id, {
          mutationType: MutationType.DELETED,
          post,
        });

        return post;
      },
    }),
    createUser: t.prismaField({
      type: 'User',
      args: {
        firstName: t.arg.string({ required: true }),
        lastName: t.arg.string({ required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const user = await db.user.create({
          ...query,
          data: {
            firstName: args.firstName,
            lastName: args.lastName,
          },
        });

        ctx.pubsub.publish('user', user.id, {
          mutationType: MutationType.CREATED,
          user,
        });

        return user;
      },
    }),
    updateUser: t.prismaField({
      type: 'User',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
        firstName: t.arg.string(),
        lastName: t.arg.string(),
      },
      resolve: async (query, _root, args, ctx) => {
        const user = await db.user.update({
          ...query,
          where: { id: Number.parseInt(String(args.id), 10) },
          data: {
            firstName: args.firstName ?? undefined,
            lastName: args.lastName ?? undefined,
          },
        });

        ctx.pubsub.publish('user', user.id, {
          mutationType: MutationType.UPDATED,
          user,
        });

        return user;
      },
    }),
    deleteUser: t.prismaField({
      type: 'User',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: async (query, _root, args, ctx) => {
        const user = await db.user.delete({
          ...query,
          where: { id: Number.parseInt(String(args.id), 10) },
        });

        ctx.pubsub.publish('user', user.id, {
          mutationType: MutationType.DELETED,
          user,
        });

        return user;
      },
    }),
  }),
});

builder.enumType(MutationType, {
  name: 'MutationType',
});

const SubscriptionEvent = builder.interfaceRef<PubSubEvent>('SubscriptionEvent').implement({
  fields: (t) => ({
    mutationType: t.exposeString('mutationType'),
  }),
});

const SubscriptionPostEvent = builder.objectRef<PubSubPostEvent>('SubscriptionPostEvent');

SubscriptionPostEvent.implement({
  interfaces: [SubscriptionEvent],
  fields: (t) => ({
    post: t.prismaField({
      type: 'Post',
      nullable: true,
      resolve: (query, event) =>
        db.post.findUnique({
          ...query,
          where: { id: event.post.id },
        }),
    }),
  }),
});

const SubscriptionUserEvent = builder.objectRef<PubSubUserEvent>('SubscriptionUserEvent');

SubscriptionUserEvent.implement({
  interfaces: [SubscriptionEvent],
  fields: (t) => ({
    user: t.prismaField({
      type: 'User',
      nullable: true,
      resolve: (query, event) =>
        db.user.findUnique({
          ...query,
          where: { id: event.user.id },
        }),
    }),
  }),
});

builder.subscriptionType({
  fields: (t) => ({
    post: t.field({
      type: SubscriptionPostEvent,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      subscribe: (_root, args, ctx) => ctx.pubsub.subscribe('post', args.id),
      resolve: (event) => event,
    }),
    posts: t.field({
      type: SubscriptionPostEvent,
      subscribe: (_root, _args, ctx) => ctx.pubsub.subscribe('posts'),
      resolve: (payload) => payload,
    }),
    user: t.field({
      type: SubscriptionUserEvent,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      subscribe: (_root, args, ctx) => ctx.pubsub.subscribe('user', args.id),
      resolve: (event) => event,
    }),
    users: t.field({
      type: SubscriptionUserEvent,
      subscribe: (_root, _args, ctx) => ctx.pubsub.subscribe('users'),
      resolve: (payload) => payload,
    }),
  }),
});

export const schema = builder.toSchema();

console.log(printSchema(schema));
