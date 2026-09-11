import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';

const builder = new SchemaBuilder({ plugins: [RelayPlugin], relay: {} });

// #region node
type UserShape = { id: string; name: string };
const users: UserShape[] = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
  { id: '3', name: 'Katherine' },
];
const User = builder.objectRef<UserShape>('User');
builder.node(User, {
  id: { resolve: (user) => user.id },
  loadOne: (id) => users.find((user) => user.id === id) ?? null,
  fields: (t) => ({ name: t.exposeString('name') }),
});
// #endregion node
builder.queryType({
  fields: (t) => ({ users: t.field({ type: [User], resolve: () => users }) }),
});
export const schema = builder.toSchema();
