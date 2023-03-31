import '@sentry/tracing';
import { createServer } from 'node:http';
import { print } from 'graphql';
import { createYoga, Plugin } from 'graphql-yoga';
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

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
});

const server = createServer(yoga);

server.listen(3000);
