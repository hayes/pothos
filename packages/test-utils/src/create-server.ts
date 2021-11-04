/* eslint-disable no-magic-numbers */
/* eslint-disable node/prefer-global/url-search-params */
/* eslint-disable node/prefer-global/url */
/* eslint-disable node/no-unsupported-features/es-builtins */
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL, URLSearchParams } from 'url';
import { ExecutionResult, GraphQLError, GraphQLSchema } from 'graphql';
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  sendResult,
  shouldRenderGraphiQL,
} from 'graphql-helix';

export interface TestServerOptions {
  schema: GraphQLSchema;
  contextFactory?: (req: IncomingMessage, res: ServerResponse) => object;
}

const formatResult = (result: ExecutionResult) => {
  const formattedResult: ExecutionResult = {
    data: result.data,
  };

  if (result.errors) {
    formattedResult.errors = result.errors.map((error) => {
      // Log the error using the logger of your choice
      console.log(error);

      // Return a generic error message instead
      return new GraphQLError(
        error.message,
        error.nodes,
        error.source,
        error.positions,
        error.path,
        error,
        {
          // Adding some metadata to the error
          timestamp: Date.now(),
          stack: error.stack,
        },
      );
    });
  }

  return formattedResult;
};

function handelRequest(
  req: IncomingMessage,
  res: ServerResponse,
  { schema, contextFactory = () => ({}) }: TestServerOptions,
) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const searchParams = new URLSearchParams(url.search);

  // if (url.pathname !== '/graphql') {
  //   res.writeHead(404, {
  //     'content-type': 'text/plain',
  //   });
  //   res.end('Not found');
  //   return;
  // }

  let payload = '';

  req.on('data', (chunk: Buffer) => {
    payload += chunk.toString();
  });

  async function handleEnd() {
    const request = {
      body: JSON.parse(payload || '{}') as unknown,
      headers: req.headers,
      method: req.method!,
      query: Object.fromEntries(searchParams),
    };

    if (shouldRenderGraphiQL(request)) {
      res.writeHead(200, {
        'content-type': 'text/html',
      });
      res.end(
        renderGraphiQL({}).replace(
          '</head>',
          `<style type="text/css">
          @media (prefers-color-scheme: dark) {
            html {
              filter: invert(1) hue-rotate(180deg);
            }
            html img,
            picture,
            video{
                filter: invert(1) hue-rotate(180deg);
            }
          }
          </style>
          </head>`,
        ),
      );
    } else {
      const { operationName, query, variables } = getGraphQLParameters(request);

      const result = await processRequest({
        operationName,
        query,
        variables,
        request,
        schema,
        contextFactory: () => contextFactory(req, res),
      });

      await sendResult(result, res, formatResult);
    }
  }

  req.on('end', () => {
    handleEnd().catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error);
      if (!res.headersSent) {
        res.statusCode = 500;
      }

      if (!res.writableEnded) {
        res.end('Server Error');
      }
    });
  });
}

export function createTestServer(options: TestServerOptions) {
  return createServer((req, res) => void handelRequest(req, res, options));
}
