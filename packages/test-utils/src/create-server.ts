import { IncomingMessage, Server, ServerResponse, createServer } from 'node:http';
import { GraphQLSchema, type execute } from 'graphql';
import { type Plugin, type YogaServerOptions, createYoga } from 'graphql-yoga';

export interface TestServerOptions<ServerContext, UserContext>
  extends YogaServerOptions<ServerContext, UserContext> {
  execute?: typeof execute;
}

export function createTestServer<
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ServerContext extends Record<string, any> = {},
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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

  return createServer(yoga);
}
