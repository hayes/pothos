import { builder } from '../builder';

export const Comment = builder.drizzleObject('comments', {
  select: {
    columns: {},
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    text: t.exposeString('text'),
    author: t.relation('author'),
    post: t.relation('post'),
  }),
});
