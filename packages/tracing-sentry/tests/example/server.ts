import '@sentry/tracing';
import { print } from 'graphql';
import { createServer, Plugin } from '@graphql-yoga/node';
import * as Sentry from '@sentry/node';
import { AttributeNames } from '../../src';
import { schema } from './schema';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1,
});

const tracingPlugin: Plugin = {
  onExecute: ({ setExecuteFn, executeFn }) => {
    setExecuteFn(async (options) => {
      const transaction = Sentry.startTransaction({
        op: 'graphql.execute',
        name: options.operationName ?? '<unnamed operation>',
        tags: {
          [AttributeNames.OPERATION_NAME]: options.operationName ?? undefined,
          [AttributeNames.SOURCE]: print(options.document),
        },
        data: {
          [AttributeNames.SOURCE]: print(options.document),
        },
      });
      Sentry.getCurrentHub().configureScope((scope) => scope.setSpan(transaction));

      try {
        const result = await executeFn(options);

        return result;
      } finally {
        transaction.finish();
      }
    });
  },
};

const server = createServer({
  schema,
  plugins: [tracingPlugin],
});

server.start().catch(console.error);
