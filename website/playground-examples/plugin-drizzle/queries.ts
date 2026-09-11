import { builder } from './builder';
import { db } from './database';
import { Viewer } from './types/viewer';

// #region author-query
builder.queryType({});
builder.queryField('author', (t) =>
  t.drizzleField({
    type: 'users',
    nullable: true,
    args: { id: t.arg.int({ required: true }) },
    resolve: (query, _root, args) => db.query.users.findFirst(query({ where: { id: args.id } })),
  }),
);
// #endregion author-query

// #region queries
builder.queryFields((t) => ({
  // #region viewer-query
  me: t.drizzleField({
    type: Viewer,
    nullable: true,
    resolve: (query, _root, _args, ctx) =>
      db.query.users.findFirst(query({ where: { id: ctx.userId } })),
  }),
  // #endregion viewer-query
  // #region posts-query
  posts: t.drizzleConnection({
    type: 'posts',
    resolve: (query) =>
      db.query.posts.findMany(
        query({
          where: { published: true },
          // Three posts share this timestamp. Pothos adds the primary key
          // to the cursor ordering, so traversing pages still visits each once.
          orderBy: { createdAt: 'desc' },
        }),
      ),
  }),
  // #endregion posts-query
}));
// #endregion queries
