import SchemaBuilder from '@pothos/core';
import { GraphqlContext } from './graphql.context';

export const schemaBuilder = new SchemaBuilder<{ Context: GraphqlContext }>({});
