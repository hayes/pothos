import { builder } from './builder';

builder.prismaObject('User', {
  select: ['id'],
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    email: t.exposeString('email'),

    // `t.relation` accepts `args` + `query` for declarative refinement
    // of the underlying include. `query` can be a literal or a
    // function of args/ctx; either way the walker stays on the
    // single-consumer fast path (no `.combine` wrap) as long as only
    // one GraphQL field touches this relation in the query.
    posts: t.relation('posts', {
      args: {
        oldestFirst: t.arg.boolean(),
        onlyPublished: t.arg.boolean(),
      },
      query: (args) => ({
        where: args.onlyPublished ? { published: 1 } : undefined,
        orderBy: (p) => (args.oldestFirst ? p.createdAt.asc() : p.createdAt.desc()),
      }),
    }),
  }),
});
