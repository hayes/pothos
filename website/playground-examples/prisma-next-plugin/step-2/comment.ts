import { builder } from './builder';

builder.prismaObject('Comment', {
  select: ['id'],
  fields: (t) => ({
    id: t.exposeID('id'),
    body: t.exposeString('body'),
    author: t.relation('author'),
    post: t.relation('post'),
  }),
});
