import { envelop, useLogger, useSchema } from '@envelop/core';
import fastify from 'fastify';
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  sendResult,
  shouldRenderGraphiQL,
} from 'graphql-helix';
import { schema as rawSchema } from './schema';

export const getEnveloped = envelop({
  plugins: [useSchema(rawSchema), useLogger()],
});

const PORT = 3000;

const app = fastify();

app.route({
  method: ['GET', 'POST'],
  url: '/graphql',
  handler: async (req, res) => {
    const { parse, validate, contextFactory, execute, schema } = getEnveloped({ req });
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };

    if (shouldRenderGraphiQL(request)) {
      res.type('text/html');

      return renderGraphiQL({});
    }

    const { operationName, query, variables } = getGraphQLParameters(request);
    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
      parse,
      validate,
      execute,
      contextFactory,
    });

    sendResult(result, res.raw);
    res.sent = true;
  },
});

app.listen(PORT, () => {
  console.log(`🚀 Server started at http://127.0.0.1:${PORT}/graphql`);
});
