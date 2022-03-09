import { ApolloServer } from 'apollo-server';
import { ApolloServerPluginInlineTraceDisabled } from 'apollo-server-core';
import { schema } from './schema';

export const server = new ApolloServer({
  schema,
  plugins: [ApolloServerPluginInlineTraceDisabled()],
});

export { schema };
