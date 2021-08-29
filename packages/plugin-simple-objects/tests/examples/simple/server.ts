import { createTestServer } from '@giraphql/test-utils';
import { User } from './data';
import schema from './schema';

const server = createTestServer({
  schema,
  contextFactory: () => ({
    User,
  }),
});

void server.listen(3000);
