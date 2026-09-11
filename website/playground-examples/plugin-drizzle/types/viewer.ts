import { builder } from '../builder';

// #region viewer
// #region viewer-interface
export const Viewer = builder.drizzleInterface('users', {
  variant: 'Viewer',
  select: { columns: { id: true, role: true } },
  resolveType: (user) => (user.role === 'editor' ? 'EditorViewer' : 'AuthorViewer'),
  fields: (t) => ({
    user: t.variant('users'),
    email: t.exposeString('email'),
    drafts: t.relation('posts', {
      query: { where: { published: false }, orderBy: { id: 'asc' } },
    }),
  }),
});
// #endregion viewer-interface
// #region viewer-implementations
builder.drizzleObject('users', {
  variant: 'EditorViewer',
  interfaces: [Viewer],
  select: { columns: { id: true, role: true } },
  fields: (t) => ({ canReviewSubmissions: t.boolean({ resolve: () => true }) }),
});
builder.drizzleObject('users', {
  variant: 'AuthorViewer',
  interfaces: [Viewer],
  select: { columns: { id: true, role: true } },
});
// #endregion viewer-implementations
// #endregion viewer

// #region user-viewer
builder.drizzleObjectField('users', 'viewer', (t) =>
  t.variant(Viewer, {
    select: { columns: { id: true } },
    isNull: (user, _args, ctx) => user.id !== ctx.userId,
  }),
);
// #endregion user-viewer
