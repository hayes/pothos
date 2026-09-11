// #region setup
import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';

const builder = new SchemaBuilder<{
  AuthScopes: {
    example: string;
  };
}>({
  plugins: [ScopeAuthPlugin],
  scopeAuth: {
    authScopes: () => ({
      example: (value) => value === 'allowed',
    }),
  },
});
// #endregion setup

builder.queryType({
  fields: (t) => ({
    allowed: t.string({ authScopes: { example: 'allowed' }, resolve: () => 'Allowed' }),
    denied: t.string({ authScopes: { example: 'blocked' }, resolve: () => 'Denied' }),
  }),
});
export const schema = builder.toSchema();
