import { sql } from 'drizzle-orm';
import builder from '../builder';
import { db } from '../db';

db.query.users.findMany({
  columns: {
    id: true,
  },
  with: {
    invitee: true,
  },
  extras: {
    lowercase: (user) => sql<string>`lower(${user.name})`.as('lowercase'),
  },
});
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
      select: {
        with: {
          posts: true,
        },
        columns: {
          invitedBy: true,
        },
        extras: {
          lowercase: (user) => sql<string>`lower(${user.name})`.as('lowercase'),
        },
      },
      resolve: (user) => `${user.lowercase.replaceAll(' ', '-')}@example.com`,
    }),
    // column values can be exposed even if they are not in the default selection (will be selected automatically)
    name: t.exposeString('name'),
    posts: t.relation('posts', {
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
        oldestFirst: t.arg.boolean(),
      },
      // use args to modify how a relation is queried
      query: (args) => ({
        limit: args.limit ?? 10,
        offset: args.offset ?? 0,
        where: {
          id: {
            NOT: 34,
          },
        },
        orderBy: (post, ops) => (args.oldestFirst ? ops.asc(post.id) : ops.desc(post.id)),
      }),
      // relation available to other plugins even when selections are at the field level
      authScopes: (user) => user.posts.length > 0,
      //                           ^?
    }),
    invitee: t.relation('invitee'),
    postsConnection: t.relatedConnection('posts', {
      description: "A connection to a user's posts",
    }),
  }),
});

builder.queryField('user', (t) =>
  t.drizzleField({
    type: 'users',
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: async (query, _root, args, _ctx, _info) => {
      const drizzleQuery = db.query.users.findFirst({
        ...query,
        where: {
          id: args.id,
        },
      });

      const result = await drizzleQuery;

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
    id: t.exposeID('id'),
    content: t.exposeString('content'),
    author: t.relation('author'),
  }),
});

builder.queryType({});

export const schema = builder.toSchema();
