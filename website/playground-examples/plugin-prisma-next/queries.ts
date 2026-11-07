import { builder } from './builder';

builder.queryType({
  fields: (t) => ({
    // #region users-query
    users: t.prismaField({
      type: ['User'],
      query: { orderBy: { id: 'asc' } },
    }),
    // #endregion users-query
    // #region posts-query
    posts: t.prismaConnection({
      type: 'Post',
      totalCount: true,
      args: { newestFirst: t.arg.boolean() },
      // Chooses the direction per request; the plugin reverses it for backward pages.
      query: (args) => ({
        where: { published: 1 },
        orderBy: { id: args.newestFirst ? 'desc' : 'asc' },
      }),
    }),
    // #endregion posts-query
  }),
});
