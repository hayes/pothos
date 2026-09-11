import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region definition
const VehicleType = {
  sedan: 'SEDAN',
  suv: 'SUV',
  truck: 'TRUCK',
  motorcycle: 'MOTORCYCLE',
} as const;

const VehicleTypeEnum = builder.enumType('VehicleType', {
  values: Object.keys(VehicleType) as (keyof typeof VehicleType)[],
});
// #endregion definition

builder.queryType({
  fields: (t) => ({
    vehicle: t.field({
      type: VehicleTypeEnum,
      args: { value: t.arg({ type: VehicleTypeEnum, required: true }) },
      resolve: (_parent, { value }) => value,
    }),
    internalValue: t.string({
      args: { value: t.arg({ type: VehicleTypeEnum, required: true }) },
      resolve: (_parent, { value }) => value,
    }),
  }),
});
export const schema = builder.toSchema();
