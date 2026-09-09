import { builder } from './builder';

builder.prismaObject('User', {
  select: ['id'],
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    email: t.exposeString('email'),
    // `t.relation('posts')` declares a field that the plugin can
    // pre-load. At schema-build time, every `t.relation` call compiles
    // to `pothosOptions.select: { [relName]: true }` — the walker reads
    // this when the parent's `t.prismaField` resolves and emits an
    // `.include(relName, …)` on the user-returned collection.
    posts: t.relation('posts'),
    comments: t.relation('comments'),
  }),
});
