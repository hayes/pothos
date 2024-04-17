/* eslint-disable no-magic-numbers */
import { createServer } from 'node:http';
import { URL, URLSearchParams } from 'node:url';
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  sendResult,
  shouldRenderGraphiQL,
} from 'graphql-helix';
import { schema } from './schema';

const server = createServer((req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const searchParams = new URLSearchParams(url.search);

  if (url.pathname !== '/graphql') {
    res.writeHead(404, {
      'content-type': 'text/plain',
    });
    res.end('Not found');
    return;
  }

  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    const request = {
      body: JSON.parse(Buffer.concat(chunks).toString() || '{}') as object,
      headers: req.headers,
      method: req.method!,
      query: Object.fromEntries(searchParams),
    };

    if (shouldRenderGraphiQL(request)) {
      res.writeHead(200, {
        'content-type': 'text/html',
      });
      res.end(renderGraphiQL());
    } else {
      const { operationName, query, variables } = getGraphQLParameters(request);

      processRequest({
        operationName,
        query,
        variables,
        request,
        schema,
      })
        .then((result) => sendResult(result, res))
        .catch(() => {
          res.statusCode = 500;
          res.end();
        });
    }
  });
});

const port = process.env.PORT ?? 3000;

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Server started at http://127.0.0.1:${port}/graphql`);
});
