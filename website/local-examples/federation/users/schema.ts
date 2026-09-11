import SchemaBuilder from '@pothos/core';
import DirectivePlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';

const builder = new SchemaBuilder({
  // If you are using other plugins, the federation plugin should be listed after plugins like auth that wrap resolvers
  plugins: [DirectivePlugin, FederationPlugin],
});

// #region entity
type UserRecord = { id: string; name: string; username: string };
const users: UserRecord[] = [{ id: '1', name: 'Leia', username: 'leia' }];

const User = builder.objectRef<UserRecord>('User').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    username: t.exposeString('username'),
  }),
});

builder.asEntity(User, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: (user) => users.find(({ id }) => user.id === id),
});
// #endregion entity

builder.queryType({
  fields: (t) => ({ user: t.field({ type: User, resolve: () => users[0] }) }),
});

export const schema = builder.toSubGraphSchema({});
