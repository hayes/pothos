/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-duplicate-imports */
import './tracer';
import { execute, Kind, OperationDefinitionNode, print } from 'graphql';
import { createTestServer } from '@pothos/test-utils';
import { AttributeNames, SpanNames } from '../../src';
import { schema } from './schema';
import { tracer } from './tracer';

const server = createTestServer({
  schema,
  execute: async (options) => {
    const operation = options.document.definitions.find(
      (def) => def.kind === Kind.OPERATION_DEFINITION,
    ) as OperationDefinitionNode;

    return tracer.startActiveSpan(
      SpanNames.EXECUTE,
      {
        attributes: {
          [AttributeNames.OPERATION_NAME]: options.operationName ?? undefined,
          [AttributeNames.OPERATION_TYPE]: operation.operation,
          [AttributeNames.SOURCE]: print(options.document),
        },
      },
      async (span) => {
        try {
          const result = await execute(options);

          return result;
        } catch (error) {
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  },
});

server.listen(3000, () => {
  console.log('🚀 Server started at http://127.0.0.1:3000');
});
