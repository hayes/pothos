/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-duplicate-imports */
import 'newrelic';
import { execute, Kind, OperationDefinitionNode, print } from 'graphql';
import newrelic from 'newrelic';
import { createTestServer } from '@pothos/test-utils';
import { AttributeNames } from '../../src';
import { schema } from './schema';

const server = createTestServer({
  schema,
  execute: (options) => {
    const operation = options.document.definitions.find(
      (def) => def.kind === Kind.OPERATION_DEFINITION,
    ) as OperationDefinitionNode;

    newrelic.addCustomAttributes({
      [AttributeNames.OPERATION_NAME]: options.operationName ?? '<unnamed operation>',
      [AttributeNames.OPERATION_TYPE]: operation.operation,
      [AttributeNames.SOURCE]: print(options.document),
    });

    return execute(options);
  },
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
