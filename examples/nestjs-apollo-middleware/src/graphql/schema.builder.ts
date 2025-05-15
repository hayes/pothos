import SchemaBuilder from '@pothos/core';
import type { GraphqlContext } from './graphql.context';

export const schemaBuilder = new SchemaBuilder<{ Context: GraphqlContext }>({});
