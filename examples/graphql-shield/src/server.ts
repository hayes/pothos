import { createServer } from '@graphql-yoga/node';
import { Context } from './builder';
import { schema } from './schema';

const PORT = 3000;

export const server = createServer<Context, unknown>({
  port: PORT,
  schema,
  context: (ctx) => ({
    ...ctx,
    user: { id: Number.parseInt(ctx.request.headers.get('x-user-id') ?? '1', 10) },
  }),
});

void server.start().then(() => {
  console.log(`🚀 Server started at http://127.0.0.1:${PORT}`);
});
