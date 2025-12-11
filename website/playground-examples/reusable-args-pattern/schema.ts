import SchemaBuilder, { type ArgBuilder } from '@pothos/core';

export interface SchemaTypes {
  Scalars: {
    ID: {
      Input: string;
      Output: string;
    };
  };
}

export type TypesWithDefaults = PothosSchemaTypes.ExtendDefaultTypes<SchemaTypes>;

const builder = new SchemaBuilder<SchemaTypes>({});

function createCommonArgs(arg: ArgBuilder<TypesWithDefaults>) {
  return {
    id: arg.id({}),
    reason: arg({ type: 'String', required: false }),
  };
}

builder.mutationType({
  fields: (t) => ({
    mutation1: t.boolean({
      args: {
        ...createCommonArgs(t.arg),
      },
      resolve: (_parent, args) => !!args.reason,
    }),
    mutation2: t.boolean({
      args: {
        ...createCommonArgs(t.arg),
      },
      resolve: (_parent, args) => !!args.reason,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({ resolve: () => 'Hello World' }),
  }),
});

export const schema = builder.toSchema();
