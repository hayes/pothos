// #region helper
import type { InputFieldBuilder } from '@pothos/core';
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

type BuilderTypes = typeof builder.$inferSchemaTypes;

function createInputFields(t: InputFieldBuilder<BuilderTypes, 'InputObject'>) {
  return {
    id: t.id({}),
    reason: t.field({ type: 'String', required: false }),
  };
}

const FirstInput = builder.inputType('InputWithCommonFields1', {
  fields: (t) => ({
    ...createInputFields(t),
  }),
});

const SecondInput = builder.inputType('InputWithCommonFields2', {
  fields: (t) => ({
    ...createInputFields(t),
  }),
});
// #endregion helper

builder.queryType({
  fields: (t) => ({
    reasons: t.string({
      args: {
        first: t.arg({ type: FirstInput, required: true }),
        second: t.arg({ type: SecondInput, required: true }),
      },
      resolve: (_parent, args) =>
        [args.first.reason, args.second.reason].filter(Boolean).join(', '),
    }),
  }),
});

export const schema = builder.toSchema();
