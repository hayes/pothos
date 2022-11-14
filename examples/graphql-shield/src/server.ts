import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

const yoga = createYoga({
  schema,
  context: (ctx) => ({
    user: { id: Number.parseInt(ctx.request.headers.get('x-user-id') ?? '1', 10) },
  }),
});

export const server = createServer(yoga);

const port = 3000;

server.listen(port);
