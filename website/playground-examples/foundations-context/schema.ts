// #region context
import SchemaBuilder from '@pothos/core';

interface User {
  id: string;
  firstName: string;
  username: string;
}

const builder = new SchemaBuilder<{
  Context: {
    currentUser: User | null;
  };
}>({});
// #endregion context

// #region query
const UserRef = builder.objectRef<User>('User').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    username: t.exposeString('username'),
  }),
});

builder.queryType({
  fields: (t) => ({
    currentUser: t.field({
      type: UserRef,
      nullable: true,
      resolve: (_root, _args, context) => context.currentUser,
    }),
  }),
});
// #endregion query

export const schema = builder.toSchema();
