import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  sendResult,
  shouldRenderGraphiQL,
} from 'graphql-helix';
import { NextApiHandler } from 'next/types';
import { schema } from '../../graphql/schema';

export default (async (req, res) => {
  const request = {
    body: req.body as object,
    headers: req.headers,
    method: req.method!,
    query: req.query,
  };

  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL({ endpoint: '/api/graphql' }));
  } else {
    const { operationName, query, variables } = getGraphQLParameters(request);

    const result = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });

    void sendResult(result, res);
  }
}) as NextApiHandler;
