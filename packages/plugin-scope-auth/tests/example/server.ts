import { createTestServer } from '@pothos/test-utils';
import schema from './schema';
import User from './user';

const server = createTestServer({
  context: ({ request }) => ({
    User: request.headers.get('x-user-id')
      ? new User(Object.fromEntries(request.headers.entries()))
      : null,
  }),
  schema,
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
