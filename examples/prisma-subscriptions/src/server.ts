import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { pubsub } from './pubsub';
import { schema } from './schema';

const yoga = createYoga({
  schema,
  context: () => ({
    pubsub,
  }),
});

const server = createServer(yoga);

const port = 3000;

server.listen(port);
