import { createTestServer } from '@pothos/test-utils';
import { PubSub } from 'graphql-subscriptions';
import { Poll } from './data';
import schema from './schema';

export const pubsub = new PubSub();

const server = createTestServer({
  schema,
  context: () => ({
    Poll,
    pubsub,
  }),
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
