import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginInlineTraceDisabled } from '@apollo/server/plugin/disabled';
import { schema } from './products';

export const server = new ApolloServer({
  schema,
  plugins: [ApolloServerPluginInlineTraceDisabled()],
});

server
  .listen(0)
  .then(({ url }) => {
    console.log(`server started at ${url}`);
  })
  .catch(console.error);
