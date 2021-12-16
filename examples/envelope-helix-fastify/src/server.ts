import fastify from 'fastify';
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  sendResult,
  shouldRenderGraphiQL,
} from 'graphql-helix';
import { envelop, useLogger, useSchema, useTiming } from '@envelop/core';
import { schema as rawSchema } from './schema';

export const getEnveloped = envelop({
  plugins: [useSchema(rawSchema), useLogger(), useTiming()],
});

const PORT = 3000;

const app = fastify();

app.route({
  method: ['GET', 'POST'],
  url: '/graphql',
  // eslint-disable-next-line consistent-return
  handler: async (req, res) => {
    const { parse, validate, contextFactory, execute, schema } = getEnveloped({ req });
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };

    if (shouldRenderGraphiQL(request)) {
      void res.type('text/html');

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

    void sendResult(result, res.raw);
    res.sent = true;
  },
});

app.listen(PORT, () => {
  console.log(`🚀 Server started at http://127.0.0.1:${PORT}/graphql`);
});
