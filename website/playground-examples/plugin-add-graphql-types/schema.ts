import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import { GraphQLObjectType, GraphQLString } from 'graphql';

type User = { name: string };

const ExistingUser = new GraphQLObjectType<User>({
  name: 'User',
  fields: { name: { type: GraphQLString } },
});

// #region definition
const builder = new SchemaBuilder<{ Objects: { User: User } }>({
  plugins: [AddGraphQLPlugin],
  add: { types: [ExistingUser] },
});

builder.queryType({
  fields: (t) => ({
    user: t.field({ type: 'User', resolve: () => ({ name: 'Leia' }) }),
  }),
});
// #endregion definition
export const schema = builder.toSchema();
