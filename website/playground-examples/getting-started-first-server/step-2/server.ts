// @ts-nocheck — illustrative; node + graphql-yoga aren't installed in the playground sandbox.
// #region server
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

const yoga = createYoga({
  schema,
  context: () => ({}),
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log('Ready at http://localhost:4000/graphql');
});
// #endregion server
