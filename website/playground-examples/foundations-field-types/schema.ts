import SchemaBuilder from '@pothos/core';

// #region model
const builder = new SchemaBuilder<{
  Objects: { Giraffe: { name: string } };
}>({});

builder.objectType('Giraffe', {
  fields: (t) => ({
    name: t.exposeString('name', {}),
  }),
});
// #endregion model

// #region object-query
builder.queryType({
  fields: (t) => ({
    giraffe: t.field({
      description: 'A giraffe',
      type: 'Giraffe',
      resolve: () => ({ name: 'Gina' }),
    }),
  }),
});
// #endregion object-query

// #region enum
const LengthUnit = builder.enumType('LengthUnit', {
  values: { Feet: {}, Meters: {} },
});

builder.objectField('Giraffe', 'preferredNeckLengthUnit', (t) =>
  t.field({
    type: LengthUnit,
    resolve: () => 'Feet' as const,
  }),
);
// #endregion enum

// #region lists
builder.queryFields((t) => ({
  giraffes: t.field({
    description: 'multiple giraffes',
    type: ['Giraffe'],
    resolve: () => [{ name: 'Gina' }, { name: 'James' }],
  }),
  giraffeNames: t.field({
    type: ['String'],
    resolve: () => ['Gina', 'James'],
  }),
}));
// #endregion lists

// #region argument
builder.queryFields((t) => ({
  giraffeByName: t.field({
    type: 'Giraffe',
    args: {
      name: t.arg.string({ required: true }),
    },
    resolve: (_root, args) => {
      if (args.name !== 'Gina') {
        throw new Error(`Unknown Giraffe ${args.name}`);
      }

      return { name: 'Gina' };
    },
  }),
}));
// #endregion argument

// #region additional-fields
builder.queryFields((t) => ({
  newestGiraffe: t.field({
    type: 'Giraffe',
    resolve: () => ({ name: 'James' }),
  }),
}));

builder.objectField('Giraffe', 'nameLength', (t) =>
  t.int({
    resolve: (parent) => parent.name.length,
  }),
);
// #endregion additional-fields

export const schema = builder.toSchema();
