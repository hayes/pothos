import { createServer } from 'node:http';
import { useExtendContext, useSchema } from '@envelop/core';
import { useParserCache } from '@envelop/parser-cache';
import { useValidationCache } from '@envelop/validation-cache';
import { useGrafast, useMoreDetailedErrors } from 'grafast/envelop';
import { createYoga } from 'graphql-yoga';
import { makeDb } from './data';
import { schema } from './schema';

// Create a Yoga instance with a GraphQL schema.
const yoga = createYoga({
  schema,
  plugins: [
    // Use our executable schema
    useSchema(schema),

    // Caching the parser results is critical for Grafast, otherwise it
    // must re-plan every GraphQL request!
    useParserCache(),
    // And we might as well cache validation whilst we're at it:
    useValidationCache(),

    // Pass your GraphQL context here:
    useExtendContext(() => ({
      /* ... */
    })),

    // This replaces graphql-js' `execute` with Grafast's own
    useGrafast(),
    useMoreDetailedErrors(),
  ],
  context: () => ({
    dccDb: makeDb(),
  }),
});

// Pass it into a server to hook into request handlers.
const server = createServer(yoga);

// Start the server and you're done!
server.listen(4000, () => {
  console.info('Server is running on http://localhost:4000/graphql');
});

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { printSchema } from 'graphql';

writeFileSync(resolve(__dirname, './schema.graphql'), printSchema(schema));
