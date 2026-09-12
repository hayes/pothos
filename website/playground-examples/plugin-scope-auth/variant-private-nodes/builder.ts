import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';

type Permission = 'readArticle' | 'editArticle';
type Context = { user: { id: string; permissions: Permission[] } | null };

export const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: { loggedIn: boolean; permission: Permission };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin],
  relay: {
    // #region node-lookup-gates
    nodeQueryOptions: {
      authScopes: { loggedIn: true },
    },
    nodesQueryOptions: {
      authScopes: { loggedIn: true },
    },
    // #endregion node-lookup-gates
    // #region node-interface-policy
    nodeTypeOptions: {
      authScopes: { loggedIn: true },
    },
    // #endregion node-interface-policy
  },
  scopeAuth: {
    authScopes: (context) => ({
      loggedIn: !!context.user,
      permission: (permission) => context.user?.permissions.includes(permission) ?? false,
    }),
    unauthorizedError: () => new Error('Not authorized'),
  },
});
