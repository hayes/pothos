import { PubSub } from 'graphql-subscriptions';
import { createTestServer } from '@giraphql/test-utils';
import { Poll } from './data';
import schema from './schema';

export const pubsub = new PubSub();

const server = createTestServer({
  schema,
  contextFactory: () => ({
    Poll,
    pubsub,
  }),
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
