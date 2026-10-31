import { builder } from '../builder';

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    // Selects its columns only when a query asks for this field.
    fullName: t.string({
      select: ['firstName', 'lastName'],
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    // Loaded with its parent as part of one ORM query.
    posts: t.relation('posts', {
      query: { where: { published: 1 }, orderBy: (post) => post.id.asc() },
    }),
    // Pages through the relation inside that same query.
    postConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: { where: { published: 1 } },
      totalCount: true,
    }),
  }),
});
