import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { type BaseContext, createContext } from './context.ts';
import { schema } from './schema/index.ts';

const yoga = createYoga<object, BaseContext>({
  schema,
  // Surface thrown error messages in responses (default yoga behaviour masks
  // them as "Unexpected error" with INTERNAL_SERVER_ERROR). Fine for a demo;
  // a production app would mask or use GraphQLError instances.
  maskedErrors: false,
  context: ({ request }) => createContext({ userId: request.headers.get('x-user-id') }),
});

const server = createServer(yoga);
const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`GraphQL ready at http://localhost:${port}/graphql`);
  console.log(
    'Authenticate by sending an `x-user-id` header (seeded ids: 1=Alice admin, 2=Bob captain, 3=Carol player, 4=Dave captain).',
  );
});
