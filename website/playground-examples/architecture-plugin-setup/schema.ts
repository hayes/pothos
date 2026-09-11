// #region setup
import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';

const builder = new SchemaBuilder({
  plugins: [ScopeAuthPlugin],
  scopeAuth: {
    authScopes: () => ({}),
  },
});
// #endregion setup

builder.queryType({ fields: (t) => ({ hello: t.string({ resolve: () => 'Hello' }) }) });
export const schema = builder.toSchema();
