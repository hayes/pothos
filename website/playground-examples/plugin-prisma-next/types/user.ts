import { builder } from '../builder';

// #region user
builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    // Selects its columns only when a query asks for this field.
    fullName: t.string({
      select: ['firstName', 'lastName'],
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
  }),
});
// #endregion user

// #region user-post-connection
// Pages through the relation inside the query that loads the user.
builder.prismaObjectField('User', 'postConnection', (t) =>
  t.relatedConnection('posts', {
    query: { where: { published: 1 } },
    totalCount: true,
  }),
);
// #endregion user-post-connection
