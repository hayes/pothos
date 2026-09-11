// #region schema
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

const LengthUnit = builder.enumType('LengthUnit', {
  values: ['Feet', 'Meters'],
});

builder.queryType({
  fields: (t) => ({
    height: t.float({
      args: {
        unit: t.arg({ type: LengthUnit, required: true, defaultValue: 'Meters' }),
      },
      resolve: (_parent, { unit }) => (unit === 'Meters' ? 5 : 5 * 3.281),
    }),
    unit: t.field({
      type: LengthUnit,
      args: { value: t.arg({ type: LengthUnit, required: true }) },
      resolve: (_parent, { value }) => value,
    }),
  }),
});

export const schema = builder.toSchema();
// #endregion schema
