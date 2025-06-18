import { createServer } from 'node:http';
import { print } from 'graphql';
import { createYoga, type Plugin } from 'graphql-yoga';
import { AttributeNames, SpanNames } from '../../src';
import { schema } from './schema';
import { tracer } from './tracer'; // Tracer must be imported first

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

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
});

const server = createServer(yoga);

server.listen(3000);
