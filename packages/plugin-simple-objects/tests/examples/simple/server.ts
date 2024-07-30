import { createTestServer } from '@pothos/test-utils';
import { User } from './data';
import schema from './schema';

const server = createTestServer({
  schema,
  context: () => ({
    User,
  }),
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
