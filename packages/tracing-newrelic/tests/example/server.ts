// eslint-disable-next-line simple-import-sort/imports
import newrelic from 'newrelic'; // newrelic must be imported first
import { print } from 'graphql';
import { createServer, Plugin } from '@graphql-yoga/node';
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

const server = createServer({
  schema,
  plugins: [tracingPlugin],
});

server.start().catch(console.error);
