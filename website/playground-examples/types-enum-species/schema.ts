import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region definition
const GiraffeSpecies = builder.enumType('GiraffeSpecies', {
  values: {
    Southern: {
      description: 'Also known as two-horned giraffe',
      value: 'giraffa',
    },
    Masai: { value: 'tippelskirchi' },
    Reticulated: { value: 'reticulata' },
    Northern: { value: 'camelopardalis' },
    Unknown: { deprecationReason: 'Use a nullable species field instead.' },
  },
});
// #endregion definition

builder.queryType({
  fields: (t) => ({
    species: t.field({
      type: GiraffeSpecies,
      args: { value: t.arg({ type: GiraffeSpecies, required: true }) },
      resolve: (_parent, { value }) => value,
    }),
    internalValue: t.string({
      args: { value: t.arg({ type: GiraffeSpecies, required: true }) },
      resolve: (_parent, { value }) => value,
    }),
  }),
});
export const schema = builder.toSchema();
