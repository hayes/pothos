import { createServer } from 'node:http';
import type { execute } from 'graphql';
import { createYoga, type Plugin, type YogaServerOptions } from 'graphql-yoga';

export interface TestServerOptions<ServerContext, UserContext>
  extends YogaServerOptions<ServerContext, UserContext> {
  execute?: typeof execute;
}

export function createTestServer<
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
  ServerContext extends Record<string, any> = {},
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
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
