import { createTestServer } from '@giraphql/test-utils';
import schema from '.';

const server = createTestServer({ schema });

server.listen(8000, () => {
  console.log('🚀 Server started at http://127.0.0.1:8000');
});
