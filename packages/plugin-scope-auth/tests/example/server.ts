import { createTestServer } from '@giraphql/test-utils';
import schema from './schema';
import User from './user';

const server = createTestServer({
  contextFactory: (req) => ({
    User: req.headers['x-user-id'] ? new User(req.headers) : null,
  }),
  schema,
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
