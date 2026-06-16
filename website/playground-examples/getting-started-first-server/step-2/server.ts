// @ts-nocheck — illustrative; node + graphql-yoga aren't installed in the playground sandbox.
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

// Yoga is the smallest path from a GraphQL schema to a running HTTP
// server. The `context` factory runs once per request — that's where
// you'd attach the authenticated user, a database client, etc.
const yoga = createYoga({
  schema,
  context: () => ({}),
});

const server = createServer(yoga);

server.listen(4000, () => {
  // GraphiQL is served at GET /graphql automatically.
  console.log('Ready at http://localhost:4000/graphql');
});
