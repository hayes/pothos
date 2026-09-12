import { builder } from './builder';
import './nodes';

// #region query-default
builder.queryType({
  authScopes: { loggedIn: true },
  fields: (t) => ({
    serviceName: t.string({
      skipTypeScopes: true,
      resolve: () => 'Publishing API',
    }),
  }),
});
// #endregion query-default

export const schema = builder.toSchema();
