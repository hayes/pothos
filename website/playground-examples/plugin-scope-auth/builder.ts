import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';

type Permission = 'readArticle' | 'editArticle';
type Context = { user: { id: string; permissions: Permission[] } | null };

// #region scopes
export const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: { loggedIn: boolean; permission: Permission };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin],
  scopeAuth: {
    authScopes: (context) => ({
      loggedIn: !!context.user,
      permission: (permission) => context.user?.permissions.includes(permission) ?? false,
    }),
    unauthorizedError: () => new Error('Not authorized'),
  },
});
// #endregion scopes
