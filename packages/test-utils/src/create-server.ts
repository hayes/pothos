/* eslint-disable no-magic-numbers */
/* eslint-disable node/prefer-global/url-search-params */
/* eslint-disable node/prefer-global/url */
/* eslint-disable node/no-unsupported-features/es-builtins */
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL, URLSearchParams } from 'url';
import { GraphQLSchema } from 'graphql';
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  shouldRenderGraphiQL,
} from 'graphql-helix';

export interface TestServerOptions {
  schema: GraphQLSchema;
  contextFactory?: (req: IncomingMessage, res: ServerResponse) => object;
}

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

      if (result.type === 'RESPONSE') {
        result.headers.forEach(({ name, value }: { name: string; value: string }) =>
          res.setHeader(name, value),
        );
        res.writeHead(result.status, {
          'content-type': 'application/json',
        });
        res.end(JSON.stringify(result.payload));
      } else if (result.type === 'MULTIPART_RESPONSE') {
        res.writeHead(200, {
          Connection: 'keep-alive',
          'Content-Type': 'multipart/mixed; boundary="-"',
          'Transfer-Encoding': 'chunked',
        });

        req.on('close', () => {
          result.unsubscribe();
        });

        res.write('---');

        await result.subscribe((subResult) => {
          const chunk = Buffer.from(JSON.stringify(subResult), 'utf8');
          const data = [
            '',
            'Content-Type: application/json; charset=utf-8',
            `Content-Length: ${String(chunk.length)}`,
            '',
            chunk,
          ];

          if (subResult.hasNext) {
            data.push('---');
          }

          res.write(data.join('\r\n'));
        });

        res.write('\r\n-----\r\n');
        res.end();
      } else {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
        });

        req.on('close', () => {
          result.unsubscribe();
        });

        await result.subscribe((subResult) => {
          res.write(`data: ${JSON.stringify(subResult)}\n\n`);
        });
      }
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
