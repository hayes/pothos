import { builder } from './builder';

builder.prismaObject('Post', {
  select: ['id'],
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    // SQLite has no native boolean; `published` is `sqlite/integer@1`
    // (0/1) in the contract. Convert at the GraphQL boundary so the
    // schema's surface stays a real Boolean. `select: ['published']`
    // declares the column dependency — the walker only auto-pulls cols
    // that map to a `t.expose*` field, so custom resolvers must list
    // what they need.
    published: t.boolean({
      select: ['published'],
      resolve: (post) => Boolean(post.published),
    }),
    // Single-relation back-references infer cardinality from the
    // contract — `author` is `N:1`, so a plain object (non-list).
    author: t.relation('author'),
    comments: t.relation('comments'),
  }),
});
