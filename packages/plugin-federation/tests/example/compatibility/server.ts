import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginInlineTraceDisabled } from '@apollo/server/plugin/disabled';
import { startStandaloneServer } from '@apollo/server/standalone';
import { schema } from './products';

export const server = new ApolloServer({
  schema,
  plugins: [ApolloServerPluginInlineTraceDisabled()],
});

startStandaloneServer(server, { listen: { port: 0 } })
  .then(({ url }) => {
    console.log(`server started at ${url}`);
  })
  .catch(console.error);
