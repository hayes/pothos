import SchemaBuilder from '@giraphql/core';
import '../../src';

type CoolPermissions = 'readStuff' | 'updateStuff' | 'readArticle';

const builder = new SchemaBuilder<{
  Context: {
    User: {
      id: number;
    };
  };
  AuthScopes: {
    loggedIn: boolean;
    admin: boolean;
    deferredAdmin: boolean;
    coolPermission: CoolPermissions;
  };
}>({
  plugins: ['GiraphQLScopeAuth'],
  authScopes: async (context) => ({
    loggedIn: true,
    admin: true,
    deferredAdmin: () => true,
    coolPermission: (perm) => true,
  }),
});

export default builder;
