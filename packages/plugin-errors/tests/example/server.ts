import { createTestServer } from '@pothos/test-utils';
import { builder } from './builder';
import { createSchema } from './schema';

const schema = createSchema(builder);

const server = createTestServer({ schema });

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
