import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

builder.queryType({});

// #region definition
enum Diet {
  HERBIVOROUS = 0,
  CARNIVOROUS = 1,
  OMNIVOROUS = 2,
}

builder.enumType(Diet, { name: 'Diet' });

builder.queryField('diet', (t) =>
  t.field({
    type: Diet,
    resolve: () => Diet.HERBIVOROUS,
  }),
);
// #endregion definition

builder.queryField('internalValue', (t) => t.int({ resolve: () => Diet.HERBIVOROUS }));
export const schema = builder.toSchema();
