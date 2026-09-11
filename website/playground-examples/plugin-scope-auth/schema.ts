import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';

type Permission = 'readArticle' | 'editArticle';
type Context = { user: { id: string; permissions: Permission[] } | null };
const article = { title: 'Getting started', writes: 0 };

// #region scopes
const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: { loggedIn: boolean; permission: Permission };
}>({
  plugins: [ScopeAuthPlugin],
  scopeAuth: {
    authScopes: (context) => ({
      loggedIn: !!context.user,
      permission: (permission) => context.user?.permissions.includes(permission) ?? false,
    }),
    unauthorizedError: () => new Error('Not authorized'),
  },
});
// #endregion scopes

builder.queryType({
  fields: (t) => ({
    // #region protected-fields
    message: t.string({ authScopes: { loggedIn: true }, resolve: () => 'hi' }),
    article: t.string({
      authScopes: { $all: { loggedIn: true, permission: 'readArticle' } },
      resolve: () => article.title,
    }),
    editPreview: t.string({
      authScopes: { $all: { loggedIn: true, permission: 'editArticle' } },
      resolve: () => 'You can edit this article',
    }),
    // #endregion protected-fields
    // Public fixture counters make skipped resolver effects observable.
    savedTitle: t.string({ resolve: () => article.title }),
    writes: t.int({ resolve: () => article.writes }),
  }),
});
builder.mutationType({
  fields: (t) => ({
    // #region protected-write
    renameArticle: t.string({
      authScopes: { $all: { loggedIn: true, permission: 'editArticle' } },
      args: { title: t.arg.string({ required: true }) },
      resolve: (_parent, { title }) => {
        article.writes += 1;
        article.title = title;
        return article.title;
      },
    }),
    // #endregion protected-write
  }),
});
export const schema = builder.toSchema();
