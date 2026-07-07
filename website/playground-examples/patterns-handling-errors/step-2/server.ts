// @ts-nocheck — illustrative; node + graphql-yoga aren't installed in the playground sandbox.
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { schema } from './schema';

// In production, leave masking on (the default). Yoga replaces the
// thrown message with a generic "Unexpected error" and logs the
// original — internal details stay on the server.
const yoga = createYoga({
  schema,
  maskedErrors: process.env.NODE_ENV !== 'production' ? false : true,
});

createServer(yoga).listen(4000);
