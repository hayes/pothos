import SchemaBuilder from '@pothos/core';
import RelayPlugin, { resolveArrayConnection } from '@pothos/plugin-relay';

const builder = new SchemaBuilder({ plugins: [RelayPlugin], relay: {} });
const users = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
  { id: '3', name: 'Katherine' },
  { id: '4', name: 'Dorothy' },
];
const User = builder.objectRef<(typeof users)[number]>('User').implement({
  fields: (t) => ({ id: t.exposeID('id'), name: t.exposeString('name') }),
});

// #region connection
builder.queryType({
  fields: (t) => ({
    users: t.connection({
      type: User,
      resolve: (_parent, args) => resolveArrayConnection({ args }, users),
    }),
  }),
});
// #endregion connection
export const schema = builder.toSchema();
