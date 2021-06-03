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
    removeMe: t.boolean(),
    notRemoved: t.boolean(),
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
        removeMe: t.arg.boolean(),
        notRemoved: t.arg.boolean(),
        testEnum: t.arg({ type: TestEnum }),
      },
      resolve: () => true,
    }),
  }),
});

builder
  .interfaceRef<{
    num: number;
    numList: number[];
    boolean: boolean;
    booleanList: boolean[];
    string: string;
    stringList: string[];
  }>('TestInterface')
  .implement({
    fields: (t) => ({
      // @ts-expect-error missing required options
      id: t.exposeID('num'),
      idWithOptions: t.exposeID('num', { exampleRequiredOptionFromPlugin: true }),
      // @ts-expect-error missing required options
      idList: t.exposeIDList('numList'),
      idListWithOptions: t.exposeIDList('numList', { exampleRequiredOptionFromPlugin: true }),
      // @ts-expect-error missing required options
      int: t.exposeInt('num'),
      intWithOptions: t.exposeInt('num', { exampleRequiredOptionFromPlugin: true }),
      // @ts-expect-error missing required options
      intList: t.exposeIntList('numList'),
      intListWithOptions: t.exposeIntList('numList', { exampleRequiredOptionFromPlugin: true }),
      // @ts-expect-error missing required options
      float: t.exposeFloat('num'),
      floatWithOptions: t.exposeFloat('num', { exampleRequiredOptionFromPlugin: true }),
      // @ts-expect-error missing required options
      floatList: t.exposeFloatList('numList'),
      floatListWithOptions: t.exposeFloatList('numList', { exampleRequiredOptionFromPlugin: true }),
      // @ts-expect-error missing required options
      boolean: t.exposeBoolean('boolean'),
      booleanWithOptions: t.exposeBoolean('boolean', { exampleRequiredOptionFromPlugin: true }),
      // @ts-expect-error missing required options
      booleanList: t.exposeBooleanList('booleanList'),
      booleanListWithOptions: t.exposeBooleanList('booleanList', {
        exampleRequiredOptionFromPlugin: true,
      }),
      // @ts-expect-error missing required options
      string: t.exposeString('string'),
      stringWithOptions: t.exposeString('string', { exampleRequiredOptionFromPlugin: true }),
      // @ts-expect-error missing required options
      stringList: t.exposeStringList('stringList'),
      stringListWithOptions: t.exposeStringList('stringList', {
        exampleRequiredOptionFromPlugin: true,
      }),
    }),
  });
builder
  .objectRef<{
    num: number;
    numList: number[];
    boolean: boolean;
    booleanList: boolean[];
    string: string;
    stringList: string[];
  }>('TestObject')
  .implement({
    fields: (t) => ({
      id: t.exposeID('num'),
      idList: t.exposeIDList('numList'),
      int: t.exposeInt('num'),
      intList: t.exposeIntList('numList'),
      float: t.exposeFloat('num'),
      floatList: t.exposeFloatList('numList'),
      boolean: t.exposeBoolean('boolean'),
      booleanList: t.exposeBooleanList('booleanList'),
      string: t.exposeString('string'),
      stringList: t.exposeStringList('stringList'),
    }),
  });

const schema = builder.toSchema({});

export default schema;
