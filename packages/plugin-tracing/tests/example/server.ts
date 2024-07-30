import { createTestServer } from '@pothos/test-utils';
import { schema } from './schema';

const server = createTestServer({
  context: () => ({
    log: console.log,
  }),
  schema,
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
