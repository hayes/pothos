import { createServer } from '@graphql-yoga/node';
import { schema } from './schema';

export const server = createServer({
  schema,
  context: (ctx) => ({
    user: { id: Number.parseInt(ctx.request.headers.get('x-user-id') ?? '1', 10) },
  }),
});

server.start().catch((error) => {
  console.error(error);
});
