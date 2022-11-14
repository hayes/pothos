import { createServer } from 'node:http';
import AWSXRay from 'aws-xray-sdk-core';
import { print } from 'graphql';
import { createYoga, Plugin } from 'graphql-yoga';
import { AttributeNames, SpanNames } from '../../src';
import { schema } from './schema';

const tracingPlugin: Plugin = {
  onExecute: ({ setExecuteFn, executeFn }) => {
    setExecuteFn(async (options) => {
      const parent = new AWSXRay.Segment('parent');

      return AWSXRay.getNamespace().runAndReturn(() => {
        AWSXRay.setSegment(parent);

        return AWSXRay.captureAsyncFunc(
          SpanNames.EXECUTE,
          (segment) => {
            if (segment) {
              segment.addAttribute(
                AttributeNames.OPERATION_NAME,
                options.operationName ?? '<unnamed operation>',
              );
              segment.addAttribute(AttributeNames.SOURCE, print(options.document));
            }

            return executeFn(options);
          },
          parent,
        );
      });
    });
  },
};

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
  maskedErrors: false,
});

const server = createServer(yoga);

server.listen(3000);
