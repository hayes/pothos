import { createServer, IncomingMessage, ServerResponse } from 'http';
import { execute, GraphQLSchema } from 'graphql';
import { createYoga, Plugin } from 'graphql-yoga';

export interface TestServerOptions {
  execute?: typeof execute;
  schema: GraphQLSchema;
  contextFactory?: (req: IncomingMessage, res: ServerResponse) => object;
}

export function createTestServer(options: TestServerOptions) {
  const executePlugin: Plugin | undefined = options.execute
    ? {
        onExecute: (event) => {
          event.setExecuteFn(options.execute!);
        },
      }
    : undefined;

  const yoga = createYoga({
    graphqlEndpoint: '/',
    graphiql: true,
    schema: options.schema,
    context: options.contextFactory ?? (() => ({})),
    plugins: executePlugin ? [executePlugin] : [],
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return createServer(yoga);
}
