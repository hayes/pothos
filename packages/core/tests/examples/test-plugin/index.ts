import builder from './builder';

const TestEnum = builder.enumType('TestEnum', {
  values: {
    REMOVE: {
      value: 'removeMe',
    },
    DONT_REMOVE: {
      value: 'dontRemoveMe',
    },
  },
});

const TestInput = builder.inputType('TestInput', {
  fields: (t) => ({
    removeMe: t.boolean({}),
    notRemoved: t.boolean({}),
  }),
});

builder.queryType({
  fields: (t) => ({
    notRemoved: t.boolean({
      resolve: () => true,
    }),
    removeMe: t.boolean({
      resolve: () => true,
    }),
    args: t.boolean({
      args: {
        input: t.arg({
          type: TestInput,
        }),
        removeMe: t.arg.boolean({}),
        notRemoved: t.arg.boolean({}),
        testEnum: t.arg({ type: TestEnum }),
      },
      resolve: () => true,
    }),
  }),
});

const schema = builder.toSchema({});

export default schema;
