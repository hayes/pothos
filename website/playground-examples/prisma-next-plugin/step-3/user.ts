import { builder } from './builder';

// Plain object type for the multi-aggregate result below. Declared
// once and reused via the ref; no schema-types coupling.
const userPostStats = builder
  .objectRef<{ total: number; published: number }>('UserPostStats')
  .implement({
    fields: (t) => ({
      total: t.exposeInt('total'),
      published: t.exposeInt('published'),
    }),
  });

builder.prismaObject('User', {
  select: ['id'],
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    email: t.exposeString('email'),
    posts: t.relation('posts'),

    // 1) Column-dependency: `select: ['firstName', 'lastName']` forces
    //    those columns into the parent SELECT even when the GraphQL
    //    client only asks for `fullName`. The parent shape narrows to
    //    `{ firstName: string; lastName: string }` — `user.email` would
    //    be a type error here.
    fullName: t.string({
      select: ['firstName', 'lastName'],
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),

    // 2) Aggregate via function-form `select`. The inner key (`posts`)
    //    names the relation; the value is a refinement that ends in a
    //    materializer-like terminal (`.count()`). The walker emits
    //    `.include('posts', sub => sub.combine({ posts: sub.count() }))`
    //    — the count comes back as `parent.posts` (a number, not a
    //    list of rows). The plugin's type inference picks this up
    //    automatically, so the resolver sees `parent.posts: number`
    //    without a cast.
    postCount: t.field({
      type: 'Int',
      select: {
        posts: (sub) => ({ posts: sub.count() }),
      },
      resolve: (parent) => parent.posts,
    }),

    // 3) Filtered count — same shape, with a `.where(...)` on the
    //    refinement collection before `.count()`. The SQL emits the
    //    predicate inside the count subquery.
    publishedPostCount: t.field({
      type: 'Int',
      select: {
        posts: (sub) => ({
          posts: sub.where((p) => p.published.eq(1)).count(),
        }),
      },
      resolve: (parent) => parent.posts,
    }),

    // 4) Multiple aggregates over the SAME relation on ONE field. The
    //    function-form's returned object lists each combine slot —
    //    here both `total` and `published` ride inside one
    //    `.include('posts', sub => sub.combine({ total: ..., published: ... }))`,
    //    and the parent surfaces both as flat keys. Useful when a
    //    GraphQL object exposes a stats block (total + filtered +
    //    average + …) without forcing one resolver per metric.
    postStats: t.field({
      type: userPostStats,
      select: {
        posts: (sub) => ({
          total: sub.count(),
          published: sub.where((p) => p.published.eq(1)).count(),
        }),
      },
      resolve: (parent) => ({
        total: parent.total,
        published: parent.published,
      }),
    }),
  }),
});
