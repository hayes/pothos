import { builder } from './builder';
import { db } from './database';

builder.queryType({
  fields: (t) => ({
    users: t.prismaField({
      type: ['User'],
      resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
    }),
    posts: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      totalCount: true,
      args: { newestFirst: t.arg.boolean() },
      // Chooses the direction per request; the plugin reverses it for backward pages.
      orderBy: (post, args) => (args.newestFirst ? post.id.desc() : post.id.asc()),
      resolve: () => db.orm.Post.where({ published: 1 }),
    }),
  }),
});
