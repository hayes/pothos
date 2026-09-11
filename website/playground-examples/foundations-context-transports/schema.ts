import SchemaBuilder from '@pothos/core';

// #region transport
type Context =
  | {
      transport: 'http';
      request: Request;
    }
  | {
      transport: 'websocket';
      connectionParams: { clientName: string };
    };

const builder = new SchemaBuilder<{
  Context: Context;
}>({});

builder.queryType({
  fields: (t) => ({
    clientName: t.string({
      nullable: true,
      resolve: (_root, _args, context) => {
        if (context.transport === 'http') {
          return context.request.headers.get('x-client-name');
        }

        return context.connectionParams.clientName;
      },
    }),
  }),
});
// #endregion transport

export const schema = builder.toSchema();
