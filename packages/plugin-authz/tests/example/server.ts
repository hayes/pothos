import { execute } from 'graphql';
import { createTestServer } from '@pothos/test-utils';
import { wrapExecuteFn } from '@graphql-authz/core';
import { rules } from './builder';
import { users } from './data';
import schema from './schema';

const server = createTestServer({
  schema,
  execute: wrapExecuteFn(execute, { rules }),
  contextFactory: (req) => ({
    user: users.find(({ id }) => id === req.headers['x-user-id']) ?? null,
  }),
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
