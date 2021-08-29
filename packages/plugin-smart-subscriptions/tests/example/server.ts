import { PubSub } from 'graphql-subscriptions';
import { createTestServer } from '@giraphql/test-utils';
import { stringPath } from '../../src';
import { Poll } from './data';
import schema from './schema';
import { ContextType } from './types';

export const pubsub = new PubSub();

const server = createTestServer({
  schema,
  contextFactory: (): ContextType => ({
    Poll,
    pubsub,
    log: (info) =>
      void console.log(`${info.operation.name?.value}: resolving ${stringPath(info.path)}`),
    logSub: (action, name) => void console.log(`${action} ${name}`),
  }),
});

void server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
