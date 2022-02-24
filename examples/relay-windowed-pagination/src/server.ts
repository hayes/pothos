import { createServer } from '@graphql-yoga/node';
import { schema } from './schema';

const PORT = 3000;

export const server = createServer({
  schema,
  port: PORT,
});

void server.start().then(() => {
  console.log(`🚀 Server started at http://127.0.0.1:${PORT}`);
});
