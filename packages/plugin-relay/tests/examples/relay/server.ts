/* eslint-disable no-console */
import { ApolloServer } from 'apollo-server';
import { PubSub } from 'graphql-subscriptions';
import { Poll } from './data';
import schema from './schema';

export const pubsub = new PubSub();

const server = new ApolloServer({
  schema,
  debug: true,
  tracing: true,
  context: () => ({
    Poll,
    pubsub,
  }),
});

server
  .listen(3000, () => {
    console.log('🚀 Server started at http://127.0.0.1:3000');
  })
  .catch(console.error);
