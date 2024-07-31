import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { execute, GraphQLSchema } from 'graphql';
import { createYoga, Plugin, YogaServerOptions } from 'graphql-yoga';

export interface TestServerOptions<ServerContext, UserContext>
  extends YogaServerOptions<ServerContext, UserContext> {
  execute?: typeof execute;
}

export function createTestServer<
  ServerContext extends Record<string, any> = {},
  UserContext extends Record<string, any> = {},
>(options: TestServerOptions<ServerContext, UserContext>) {
  const executePlugin: Plugin | undefined = options.execute
    ? {
        onExecute: (event) => {
          event.setExecuteFn(options.execute!);
        },
      }
    : undefined;

  const yoga = createYoga({
    ...options,
    graphqlEndpoint: '/',
    graphiql: true,
    context: options.context ?? (() => ({})),
    plugins: executePlugin ? [executePlugin] : [],
    maskedErrors: {
      isDev: true,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return createServer(yoga);
}
