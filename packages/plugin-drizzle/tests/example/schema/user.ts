import { sql } from 'drizzle-orm';
import { builder } from '../builder';
import { comments, users } from '../db/schema';

export const Viewer = builder.drizzleObject('users', {
  variant: 'Viewer',
  select: {
    columns: {},
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.string({
      select: {
        columns: {
          username: true,
        },
      },
      resolve: (user) => `@${user.username}`,
    }),
    user: t.variant('users'),
    comments: t.relatedConnection('comments', {
      query: {
        orderBy: (comment) => {
          return {
            desc: comment.id,
          };
        },
      },
    }),
    drafts: t.relation('posts', {
      query: {
        where: {
          published: 0,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
    }),
    roles: t.stringList({
      select: {
        with: {
          roles: true,
        },
      },
      resolve: (user) => user.roles.map((role) => role.name),
    }),
  }),
});

export const User = builder.drizzleNode('users', {
  name: 'User',
  id: {
    column: (user) => user.id,
  },
  select: {
    columns: {
      firstName: true,
      lastName: true,
    },
    with: {
      profile: true,
    },
  },
  fields: (t) => ({
    email: t.string({
      select: {
        extras: {
          lowercase: sql<string>`lower(${users.firstName})`.as('lowercase'),
        },
      },
      resolve: (user) => `${user.lowercase}@example.com`,
    }),
    bio: t.string({
      resolve: (user) => user.profile?.bio,
    }),
    // column values can be exposed even if they are not in the default selection (will be selected automatically)
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    isAdmin: t.boolean({
      select: {
        columns: {},
        with: {
          roles: true,
        },
      },
      nullable: false,
      resolve: (user) => user.roles?.some((role) => role.name === 'admin') ?? false,
    }),
    fullName: t.string({
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    posts: t.relation('posts', {
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
      },
      query: (args) => ({
        limit: args.limit ?? 10,
        offset: args.offset ?? 0,
        where: {
          published: 1,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    }),
    postsConnection: t.relatedConnection('posts', {
      query: () => ({
        where: {
          published: 1,
        },
        // Ordering requires a different format for connections so that cursor pagination can be inverted
        orderBy: (post) => {
          return {
            desc: post.id,
          };
        },
      }),
    }),
    unOrderedPostsConnection: t.relatedConnection('posts', {
      query: () => ({
        where: {
          published: 1,
        },
      }),
    }),
    viewer: t.variant(Viewer, {
      select: {
        id: true,
      },
      isNull: (user, _args, ctx) => user.id !== ctx.user?.id,
    }),
  }),
});
