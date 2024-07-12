import { not, sql } from 'drizzle-orm';
import builder from '../builder';
import { db } from '../db';

builder.drizzleObject('users', {
  name: 'User',
  // Default selection when query users (optional, defaults to all columns)
  select: {
    columns: {
      id: true,
    },
    with: {
      invitee: {
        columns: {
          name: true,
        },
      },
    },
  },
  fields: (t) => ({
    email: t.string({
      resolve: (user) => `${user.lowercase.replace(' ', '-')}@example.com`,
      // field level selects can be merged in (only queried when the field is requested)
      // combines with selections from object level
      select: {
        // with: {
        //   posts: true,
        // },
        columns: {
          invitedBy: true,
        },
        extras: {
          lowercase: sql<string>`lower(name)`.as('lowercase'),
        },
      },
    }),
    // column values can be exposed even if they are not in the default selection (will be selected automatically)
    name: t.exposeString('name'),
    posts: t.relation('posts', {
      args: {
        limit: t.arg.int(),
      },
      // use args to modify how a relation is queried
      query: (args) => ({
        limit: args.limit ?? 10,
        where: (post, { eq }) => not(eq(post.id, 1)),
      }),
      // relation available to other plugins even when selections are at the field level
      // authScopes: (user) => user.posts.length > 0,
      //                           ^?
    }),
    invitee: t.relation('invitee'),
    // postsConnection: t.relatedConnection('posts', {
    //   description: "A connection to a user's posts",
    //   resolve: (user) => user.posts,
    // }),
  }),
});

builder.queryField('user', (t) =>
  t.drizzleField({
    type: 'users',
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (query, root, args, ctx, info) => {
      const result = await db.query.users.findFirst({
        ...query,
        where: (user, { eq }) => eq(user.id, args.id),
      });

      return result;
    },
  }),
);

builder.drizzleObject('posts', {
  name: 'Post',
  select: {
    columns: {
      id: true,
    },
  },
  fields: (t) => ({
    content: t.exposeString('content'),
    author: t.relation('author'),
  }),
});

builder.queryType({});

export const schema = builder.toSchema();
