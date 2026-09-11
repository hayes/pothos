import SchemaBuilder from '@pothos/core';

type Giraffe = {
  name: string;
  birthdate: string;
  height: number;
};

// #region builder
const builder = new SchemaBuilder<{
  Inputs: {
    GiraffeInput: Giraffe;
  };
}>({});
// #endregion builder
const giraffes: Giraffe[] = [];

const GiraffeRef = builder.objectRef<Giraffe>('Giraffe').implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    birthdate: t.exposeString('birthdate'),
    height: t.exposeFloat('height'),
  }),
});

builder.queryType({
  fields: (t) => ({
    giraffes: t.field({ type: [GiraffeRef], resolve: () => giraffes }),
  }),
});

// #region input
builder.inputType('GiraffeInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    birthdate: t.string({ required: true }),
    height: t.float({ required: true }),
  }),
});
// #endregion input

builder.mutationType({
  fields: (t) => ({
    createGiraffe: t.field({
      type: GiraffeRef,
      args: {
        // #region argument
        input: t.arg({ type: 'GiraffeInput', required: true }),
        // #endregion argument
      },
      resolve: (_root, { input }) => {
        giraffes.push(input);
        return input;
      },
    }),
  }),
});
export const schema = builder.toSchema();
