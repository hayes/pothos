import { builder } from './builder';

// #region recent-posts-query
builder.queryType({
  fields: (t) => ({
    recentPosts: t.prismaField({
      type: ['Post'],
      query: { where: { published: 1 }, orderBy: { id: 'desc' }, limit: 10 },
    }),
  }),
});
// #endregion recent-posts-query

builder.queryFields((t) => ({
  author: t.prismaField({
    type: 'User',
    nullable: true,
    args: { id: t.arg.int({ required: true }) },
    query: (args) => ({ where: { id: args.id } }),
  }),
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
}));
