// Step 4 — top-level filters and per-field args.
//
// `t.prismaField`'s resolver can return any collection chain, so the
// resolver is the natural place to filter at the top level. Combine
// that with `t.relation`'s `args` + `query` (see `user.ts`) and you
// can drive every WHERE / ORDER BY in the SQL from GraphQL variables
// without leaving the schema definition.

import { builder } from './builder';
import { db } from './db';
import './user';
import './post';

builder.queryType({
  fields: (t) => ({
    // Single-row collection: `.where(u => u.id.eq(...))` returns a
    // collection that the plugin auto-materializes via `.first()` for
    // a non-list GraphQL return type. The resolver still just returns
    // the collection — no `await` needed.
    user: t.prismaField({
      type: 'User',
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, args) => db.orm.User.where((u) => u.id.eq(String(args.id))),
    }),

    // Top-level filter via the collection's fluent API. Selection set
    // still drives column projection / nested includes; `where` here
    // only contributes the WHERE clause for the `post` table.
    publishedPosts: t.prismaField({
      type: ['Post'],
      resolve: () => db.orm.Post.where((p) => p.published.eq(1)),
    }),
  }),
});

export const schema = builder.toSchema();
