import { builder } from './builder';

builder.prismaObject('User', {
  select: ['id'],
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    email: t.exposeString('email'),

    // `t.relatedConnection` pages a to-many relation INSIDE the parent
    // include — no separate prisma-next query. The pagination compiles
    // to (roughly):
    //   .include('posts', sub =>
    //      sub.where(cursor predicate).orderBy(cursor).take(limit + 1))
    // The `+ 1` is how the connection builder decides `hasNextPage`
    // without a follow-up round-trip.
    //
    // `cursor: 'id'` uses the `id` column as the cursor. For
    // lexicographic compound cursors, pass a tuple — see
    // `pagedPostsConnection` below.
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      totalCount: true,
    }),

    // Same relation, paged by a compound cursor `[createdAt, id]`.
    // Lexicographic ordering: rows ordered by `createdAt` first, then
    // `id` as the tiebreaker. Both columns get pulled into the SELECT
    // automatically so each edge can encode its cursor.
    //
    // `defaultSize` / `maxSize` clamp `first:` — when the client passes
    // a larger value than `maxSize`, the connection clamps silently
    // (no error) so the SQL panel's `LIMIT` is always honest.
    pagedPostsConnection: t.relatedConnection('posts', {
      cursor: ['createdAt', 'id'] as const,
      defaultSize: 2,
      maxSize: 10,
    }),
  }),
});
