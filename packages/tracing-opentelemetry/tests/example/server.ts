// eslint-disable-next-line simple-import-sort/imports
import { tracer } from './tracer'; // Tracer must be imported first
import { print } from 'graphql';
import { createServer, Plugin } from '@graphql-yoga/node';
import { AttributeNames, SpanNames } from '../../src';
import { schema } from './schema';

const tracingPlugin: Plugin = {
  onExecute: ({ setExecuteFn, executeFn }) => {
    setExecuteFn((options) =>
      tracer.startActiveSpan(
        SpanNames.EXECUTE,
        {
          attributes: {
            [AttributeNames.OPERATION_NAME]: options.operationName ?? undefined,
            [AttributeNames.SOURCE]: print(options.document),
          },
        },
        async (span) => {
          try {
            const result = await executeFn(options);

            return result;
          } catch (error) {
            span.recordException(error as Error);
            throw error;
          } finally {
            span.end();
          }
        },
      ),
    );
  },
};

const server = createServer({
  schema,
  plugins: [tracingPlugin],
});

server.start().catch(console.error);
