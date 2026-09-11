// #region schema
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder<{
  DefaultFieldNullability: false;
  DefaultInputFieldRequiredness: true;
}>({
  defaultFieldNullability: false,
  defaultInputFieldRequiredness: true,
});

const GreetingInput = builder.inputType('GreetingInput', {
  fields: (t) => ({
    name: t.string(),
    title: t.string({ required: false }),
  }),
});

builder.queryType({
  fields: (t) => ({
    greeting: t.string({
      args: { input: t.arg({ type: GreetingInput }) },
      resolve: (_parent, { input }) =>
        `Hello, ${input.title ? `${input.title} ` : ''}${input.name}!`,
    }),
    nickname: t.string({ nullable: true, resolve: () => null }),
    names: t.stringList({ resolve: () => ['Ada'] }),
  }),
});

export const schema = builder.toSchema();
// #endregion schema
