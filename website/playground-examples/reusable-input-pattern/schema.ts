import SchemaBuilder, { type InputFieldBuilder } from '@pothos/core';

interface InputWithCommonFieldsShape {
  id: string;
  reason?: string | null;
}

export interface SchemaTypes {
  Scalars: {
    ID: {
      Input: string;
      Output: string;
    };
  };
  InputObjects: {
    InputWithCommonFields1: InputWithCommonFieldsShape;
    InputWithCommonFields2: InputWithCommonFieldsShape;
  };
}

export type TypesWithDefaults = PothosSchemaTypes.ExtendDefaultTypes<SchemaTypes>;

const builder = new SchemaBuilder<SchemaTypes>({});

function createInputFields(t: InputFieldBuilder<TypesWithDefaults, 'InputObject'>) {
  return {
    id: t.id({}),
    reason: t.field({ type: 'String', required: false }),
  };
}

const InputWithCommonFields1 = builder.inputType('InputWithCommonFields1', {
  fields: (t) => ({
    ...createInputFields(t),
  }),
});

const InputWithCommonFields2 = builder.inputType('InputWithCommonFields2', {
  fields: (t) => ({
    ...createInputFields(t),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createWithInput1: t.boolean({
      args: {
        input: t.arg({ type: InputWithCommonFields1, required: true }),
      },
      resolve: (_parent, { input }) => !!input.reason,
    }),
    createWithInput2: t.boolean({
      args: {
        input: t.arg({ type: InputWithCommonFields2, required: true }),
      },
      resolve: (_parent, { input }) => !!input.reason,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({ resolve: () => 'Hello World' }),
  }),
});

export const schema = builder.toSchema();
