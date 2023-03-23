import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';
import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '../../../src';

interface Types {
  Context: {};
  Scalars: {
    ID: {
      Input: string;
      Output: number | string;
    };
  };
  Objects: {
    ExtraType: Extra;
    ExtraTypeFromSchema: Extra;
  };
}

interface Extra {
  extra: string;
}

const ExtraType = new GraphQLObjectType<Extra>({
  name: 'ExtraType',
  fields: () => ({
    extra: {
      type: GraphQLString,
    },
  }),
});

const ExtraTypeFromSchema = new GraphQLObjectType<Extra>({
  name: 'ExtraTypeFromSchema',
  fields: () => ({
    extra: {
      type: GraphQLString,
    },
  }),
});

const extraSchema = new GraphQLSchema({
  types: [ExtraTypeFromSchema],
});

export const builder = new SchemaBuilder<Types>({
  plugins: [AddGraphQLPlugin],
  add: {
    schema: extraSchema,
    types: [ExtraType],
  },
});
