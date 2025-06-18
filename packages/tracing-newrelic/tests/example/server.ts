import { createServer } from 'node:http';
import { print } from 'graphql';
import { createYoga, type Plugin } from 'graphql-yoga';
import newrelic from 'newrelic'; // newrelic must be imported first
import { AttributeNames } from '../../src';
import { schema } from './schema';

const tracingPlugin: Plugin = {
  onExecute: ({ args }) => {
    newrelic.addCustomAttributes({
      [AttributeNames.OPERATION_NAME]: args.operationName ?? '<unnamed operation>',
      [AttributeNames.SOURCE]: print(args.document),
    });
  },
};

const yoga = createYoga({
  schema,
  plugins: [tracingPlugin],
});

const server = createServer(yoga);

server.listen(3000);
