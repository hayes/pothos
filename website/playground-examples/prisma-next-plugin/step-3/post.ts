import { builder } from './builder';

builder.prismaObject('Post', {
  select: ['id'],
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    published: t.boolean({
      select: ['published'],
      resolve: (post) => Boolean(post.published),
    }),
    author: t.relation('author'),
  }),
});
