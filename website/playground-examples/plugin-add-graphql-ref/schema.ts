import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import { GraphQLObjectType, GraphQLString } from 'graphql';

type User = { name: string };

const ExistingUser = new GraphQLObjectType<User>({
  name: 'User',
  fields: { name: { type: GraphQLString } },
});

// #region definition
const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin] });

const ImportedUser = builder.addGraphQLObject<User>(ExistingUser, {
  name: 'ImportedUser',
  fields: (t) => ({
    name: null,
    displayName: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.field({ type: ImportedUser, resolve: () => ({ name: 'Leia' }) }),
  }),
});
// #endregion definition
export const schema = builder.toSchema();
