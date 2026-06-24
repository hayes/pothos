import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';

const builder = new SchemaBuilder<{
  Context: {
    user?: { id: string; isEmployee: boolean };
  };
  // Types used for scope parameters
  AuthScopes: {
    public: boolean;
    employee: boolean;
    authenticated: boolean;
  };
}>({
  plugins: [ScopeAuthPlugin],
  scopeAuth: {
    // scope initializer, create the scopes for each request
    authScopes: async (context) => ({
      public: true,
      authenticated: !!context.user,
      employee: context.user?.isEmployee ?? false,
    }),
  },
});

builder.queryType({
  fields: (t) => ({
    // Public field - anyone can access
    message: t.string({
      authScopes: {
        public: true,
      },
      resolve: () => 'Hello, world!',
    }),
    // Protected field - requires authentication
    secretMessage: t.string({
      authScopes: {
        authenticated: true,
      },
      resolve: () => 'This is a secret message!',
    }),
    // Employee-only field
    employeeInfo: t.string({
      authScopes: {
        employee: true,
      },
      resolve: () => 'Employee-only information',
    }),
  }),
});

export const schema = builder.toSchema();
