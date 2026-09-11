import { builder } from '../builder';

// #region post
builder.drizzleObject('posts', {
  name: 'Post',
  select: {},
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author'),
    media: t.relation('media'),
    mediaConnection: t.relatedConnection('media', {
      query: { orderBy: { id: 'asc' } },
      totalCount: true,
    }),
  }),
});
builder.drizzleObject('media', {
  name: 'Media',
  fields: (t) => ({ url: t.exposeString('url'), uploadedBy: t.relation('uploadedBy') }),
});
// #endregion post
