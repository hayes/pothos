import { builder } from '../builder';

// #region post
builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});
// #endregion post
