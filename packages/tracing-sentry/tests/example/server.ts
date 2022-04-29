import '@sentry/tracing';
import { execute, Kind, OperationDefinitionNode, print } from 'graphql';
import { createTestServer } from '@pothos/test-utils';
import * as Sentry from '@sentry/node';
import { AttributeNames } from '../../src';
import { schema } from './schema';

Sentry.init({
  dsn: 'https://9b8e1ec66bcb4eb3a33d40af0627ff49@o1224608.ingest.sentry.io/6369640',
  tracesSampleRate: 1,
});

const server = createTestServer({
  schema,
  execute: async (options) => {
    const operation = options.document.definitions.find(
      (def) => def.kind === Kind.OPERATION_DEFINITION,
    ) as OperationDefinitionNode;

    const transaction = Sentry.startTransaction({
      op: 'graphql.execute',
      name: options.operationName ?? '<unnamed operation>',
      tags: {
        [AttributeNames.OPERATION_NAME]: options.operationName ?? undefined,
        [AttributeNames.OPERATION_TYPE]: operation.operation,
      },
      data: {
        [AttributeNames.SOURCE]: print(options.document),
      },
    });
    Sentry.getCurrentHub().configureScope((scope) => scope.setSpan(transaction));

    try {
      const result = await execute(options);

      return result;
    } finally {
      transaction.finish();
    }
  },
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
