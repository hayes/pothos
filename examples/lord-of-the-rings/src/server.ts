import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import type { Context } from './builder.ts';
import { schema } from './schema/index.ts';

const yoga = createYoga<object, Context>({
  schema,
  context: () => ({
    // Hard-coded "logged in" user for demo purposes. Swap for real auth in your app.
    userId: 'u-frodo-fan',
  }),
});

const server = createServer(yoga);
const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`GraphQL ready at http://localhost:${port}/graphql`);
});
