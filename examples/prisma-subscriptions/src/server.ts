import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { pubsub } from './pubsub.ts';
import { schema } from './schema.ts';

const yoga = createYoga({
  schema,
  context: () => ({
    pubsub,
  }),
});

const server = createServer(yoga);

const port = 3000;

server.listen(port);
