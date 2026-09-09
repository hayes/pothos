// @ts-nocheck — illustrative; node + graphql-yoga aren't installed in the playground sandbox.
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

// In development, turn masking off so the raw thrown message reaches
// the client. Easier to debug; not safe to ship.
const yoga = createYoga({
  schema,
  maskedErrors: false,
});

createServer(yoga).listen(4000);
