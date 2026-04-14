import Fastify from 'fastify';
import mercurius from 'mercurius';
import { schema } from './schema.ts';

const app = Fastify({ logger: true });

await app.register(mercurius, {
  schema,
  graphiql: true,
});

const port = 3000;
await app.listen({ port });
