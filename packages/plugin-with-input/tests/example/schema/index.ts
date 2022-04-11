import builder from '../builder';

builder.queryType({});
builder.mutationType({});
builder.subscriptionType({});

builder.queryField('exampleQuery', (t) =>
  t.fieldWithInput({
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    resolve: (root, args) => args.input.id,
  }),
);

builder.mutationField('exampleMutation', (t) =>
  t.fieldWithInput({
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    resolve: (root, args) => args.input.id,
  }),
);

builder.subscriptionField('exampleSubscription', (t) =>
  t.fieldWithInput({
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    resolve: (root, args) => args.input.id,
    async *subscribe() {
      yield await {};
      return {};
    },
  }),
);

const TestObj = builder.objectRef<{ id: number }>('TestObj').implement({
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});

builder.queryField('obj', (t) =>
  t.field({
    type: TestObj,
    resolve: () => ({ id: 987 }),
  }),
);

builder.objectField(TestObj, 'exampleObjectField', (t) =>
  t.fieldWithInput({
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    resolve: (root, args) => args.input.id,
  }),
);

const TestInterface = builder.interfaceRef<{ id: number }>('TestInterface').implement({
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});

builder.queryField('iface', (t) =>
  t.field({
    type: TestInterface,
    resolve: () => ({ id: 987 }),
  }),
);

builder.objectRef<{ id: number }>('ObjWithInterface').implement({
  interfaces: [TestInterface],
  isTypeOf: () => true,
});

builder.interfaceField(TestInterface, 'exampleInterfaceField', (t) =>
  t.fieldWithInput({
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    resolve: (root, args) => args.input.id,
  }),
);

builder.queryField('withOptions', (t) =>
  t.fieldWithInput({
    typeOptions: {
      name: 'TestQueryInput',

      description: 'input field',
    },
    argOptions: {
      required: false,
      name: 'custom',
    },
    description: 'query field',
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    // @ts-expect-error input is not required
    resolve: (root, args) => args.custom.id,
  }),
);

builder.mutationField('withOptions', (t) =>
  t.fieldWithInput({
    typeOptions: {
      name: 'TestMutationInput',

      description: 'input field',
    },
    argOptions: {
      name: 'custom',
    },
    description: 'mutation field',
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    resolve: (root, args) => args.custom.id,
  }),
);

builder.subscriptionField('withOptions', (t) =>
  t.fieldWithInput({
    typeOptions: {
      name: 'TestSubscriptionInput',

      description: 'input field',
    },
    argOptions: {
      name: 'custom',
    },
    description: 'subscription field',
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    resolve: (root, args) => args.custom.id,
    async *subscribe() {
      yield await {};
      return {};
    },
  }),
);

builder.objectField(TestObj, 'withOptions', (t) =>
  t.fieldWithInput({
    typeOptions: {
      name: 'TestObjectInput',

      description: 'input field',
    },
    argOptions: {
      name: 'custom',
    },
    description: 'object field',
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    resolve: (root, args) => args.custom.id,
  }),
);

builder.interfaceField(TestInterface, 'withOptions', (t) =>
  t.fieldWithInput({
    typeOptions: {
      name: 'TestInterfaceInput',

      description: 'input field',
    },
    argOptions: {
      name: 'custom',
    },
    description: 'interface field',
    input: {
      id: t.input.id({ required: true }),
    },
    type: 'ID',
    resolve: (root, args) => args.custom.id,
  }),
);

export default builder.toSchema({});
