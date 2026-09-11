// #region schema
import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';

type User = { name: string };

const ExistingUser = new GraphQLObjectType<User>({
  name: 'User',
  fields: { name: { type: GraphQLString } },
});

const existingSchema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      user: {
        type: ExistingUser,
        resolve: () => ({ name: 'Leia' }),
      },
    },
  }),
});

const builder = new SchemaBuilder<{ Objects: { User: User } }>({
  plugins: [AddGraphQLPlugin],
  add: { schema: existingSchema },
});

builder.queryFields((t) => ({
  otherUser: t.field({
    type: 'User',
    resolve: () => ({ name: 'Luke' }),
  }),
}));

export const schema = builder.toSchema();
// #endregion schema
