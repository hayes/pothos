import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region lookup-input
export const GiraffeLookup = builder.inputType('GiraffeLookup', {
  isOneOf: true,
  fields: (t) => ({
    id: t.id({ required: false }),
    name: t.string({ required: false }),
  }),
});
// #endregion lookup-input

const giraffes = [{ id: '1', name: 'Gina' }];

// #region lookup-query
builder.queryType({
  fields: (t) => ({
    giraffeName: t.string({
      args: {
        by: t.arg({ type: GiraffeLookup, required: true }),
      },
      resolve: (_root, { by }) => {
        if (by.id !== undefined) {
          return giraffes.find((giraffe) => giraffe.id === by.id)?.name;
        }

        return giraffes.find((giraffe) => giraffe.name === by.name)?.name;
      },
    }),
  }),
});
// #endregion lookup-query

export const schema = builder.toSchema();
