import { builder } from './builder';
import { db } from './database';

builder.queryType({
  fields: (t) => ({
    // #region users-query
    users: t.prismaField({
      type: ['User'],
      resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
    }),
    // #endregion users-query
    // #region posts-query
    posts: t.prismaConnection({
      type: 'Post',
      totalCount: true,
      args: { newestFirst: t.arg.boolean() },
      // Chooses the direction per request; the plugin reverses it for backward pages.
      query: (args) => ({ orderBy: { id: args.newestFirst ? 'desc' : 'asc' } }),
      resolve: () => db.orm.Post.where({ published: 1 }),
    }),
    // #endregion posts-query
  }),
});
