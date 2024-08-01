import { createTestServer } from '@pothos/test-utils';
import { PubSub } from 'graphql-subscriptions';
import { stringPath } from '../../src';
import { Poll } from './data';
import schema from './schema';
import type { ContextType } from './types';

export const pubsub = new PubSub();

const server = createTestServer({
  schema,
  context: (): ContextType => ({
    Poll,
    pubsub,
    log: (info) => console.log(`${info.operation.name?.value}: resolving ${stringPath(info.path)}`),
    logSub: (action, name) => console.log(`${action} ${name}`),
  }),
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
