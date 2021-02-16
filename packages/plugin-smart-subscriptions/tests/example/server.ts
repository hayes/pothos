import { ApolloServer } from 'apollo-server';
import { PubSub } from 'graphql-subscriptions';
import { stringPath } from '../../src';
import { Poll } from './data';
import schema from './schema';
import { ContextType } from './types';

export const pubsub = new PubSub();

const server = new ApolloServer({
  schema,
  debug: true,
  tracing: true,
  context: (): ContextType => ({
    Poll,
    pubsub,
    log: (info) =>
      // eslint-disable-next-line no-console
      void console.log(`${info.operation.name?.value}: resolving ${stringPath(info.path)}`),
    logSub: (action, name) =>
      // eslint-disable-next-line no-console
      void console.log(`${action} ${name}`),
  }),
});

void server.listen(3000, () => {
  // eslint-disable-next-line no-console
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
