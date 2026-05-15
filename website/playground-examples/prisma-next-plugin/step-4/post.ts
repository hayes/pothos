import { builder } from './builder';

builder.prismaObject('Post', {
  select: ['id'],
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    // `published` and `createdAt` declare their column deps explicitly
    // — without `select`, the walker doesn't know these resolvers need
    // the underlying columns, so `post.published` / `post.createdAt`
    // would be `undefined` (Lesson from step 1: selection-driven SELECT
    // means columns the GraphQL surface doesn't expose by name aren't
    // pulled by default).
    published: t.boolean({
      select: ['published'],
      resolve: (post) => Boolean(post.published),
    }),
    createdAt: t.string({
      select: ['createdAt'],
      resolve: (post) => new Date(post.createdAt).toISOString(),
    }),
    author: t.relation('author'),
  }),
});
