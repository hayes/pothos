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
    setExecuteFn((options) =>
      Sentry.startSpan(
        {
          op: 'graphql.execute',
          name: options.operationName ?? '<unnamed operation>',
          forceTransaction: true,
          attributes: {
            [AttributeNames.OPERATION_NAME]: options.operationName ?? undefined,
            [AttributeNames.SOURCE]: print(options.document),
          },
        },
        () => executeFn(options),
      ),
    );
  },
};

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(yoga);

server.listen(3000);
