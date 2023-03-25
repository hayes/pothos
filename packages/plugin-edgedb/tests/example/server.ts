import { createTestServer } from '@pothos/test-utils';
import { db } from './db';
import schema from './schema';

const server = createTestServer({
  schema,
  contextFactory: () => ({ user: { id: 'a04bf8b8-1bfd-11ed-93f8-836b78753212' } }),
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
