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
      await Sentry.withScope(async (scope) => {
        scope.setTags({
          [AttributeNames.OPERATION_NAME]: options.operationName ?? undefined,
          [AttributeNames.SOURCE]: print(options.document),
        })

        const transaction = Sentry.startInactiveSpan({
          op: 'graphql.execute',
          name: options.operationName ?? '<unnamed operation>',
        })

        transaction.setAttribute(AttributeNames.SOURCE, print(options.document));

        try {
          const result = await executeFn(options);

          return result;
        } finally {
          transaction.end();
        }
      })
    });
  },
};

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(yoga);

server.listen(3000);
