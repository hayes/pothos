import { createTestServer } from '@pothos/test-utils';
import { createContext } from './context';
import schema from './schema';

const server = createTestServer({
  schema,
  context: createContext,
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
