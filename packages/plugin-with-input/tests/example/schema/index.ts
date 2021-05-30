import builder from '../builder';

builder.queryType({});
builder.mutationType({});
builder.subscriptionType({});

builder.queryFieldWithInput(
  'exampleQuery',
  {
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    type: 'ID',
    resolve: (root, args) => args.input.id,
  },
);

builder.mutationFieldWithInput(
  'exampleMutation',
  {
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    type: 'ID',
    resolve: (root, args) => args.input.id,
  },
);

builder.subscriptionFieldWithInput(
  'exampleSubscription',
  {
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    type: 'ID',
    resolve: (root, args) => args.input.id,
    async *subscribe() {
      yield await {};
      return {};
    },
  },
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

builder.objectFieldWithInput(
  TestObj,
  'exampleObjectField',
  {
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    type: 'ID',
    resolve: (root, args) => args.input.id,
  },
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

builder.interfaceFieldWithInput(
  TestInterface,
  'exampleInterfaceField',
  {
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    type: 'ID',
    resolve: (root, args) => args.input.id,
  },
);

builder.queryFieldWithInput(
  'withOptions',
  {
    name: 'TestQueryInput',
    argName: 'custom',
    description: 'input field',
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    type: 'ID',
    description: 'query field',
    resolve: (root, args) => args.custom.id,
  },
);

builder.mutationFieldWithInput(
  'withOptions',
  {
    name: 'TestMutationInput',
    argName: 'custom',
    description: 'input field',
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    description: 'mutation field',
    type: 'ID',
    resolve: (root, args) => args.custom.id,
  },
);

builder.subscriptionFieldWithInput(
  'withOptions',
  {
    name: 'TestSubscriptionInput',
    argName: 'custom',
    description: 'input field',
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    type: 'ID',
    description: 'subscription field',
    resolve: (root, args) => args.custom.id,
    async *subscribe() {
      yield await {};
      return {};
    },
  },
);

builder.objectFieldWithInput(
  TestObj,
  'withOptions',
  {
    name: 'TestObjectInput',
    argName: 'custom',
    description: 'input field',
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    type: 'ID',
    description: 'object field',
    resolve: (root, args) => args.custom.id,
  },
);

builder.interfaceFieldWithInput(
  TestInterface,
  'withOptions',
  {
    name: 'TestInterfaceInput',
    argName: 'custom',
    description: 'input field',
    inputFields: (t) => ({
      id: t.id({ required: true }),
    }),
  },
  {
    type: 'ID',
    description: 'interface field',
    resolve: (root, args) => args.custom.id,
  },
);

export default builder.toSchema({});
