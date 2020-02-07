import SchemaBuilder from '@giraphql/core';

interface Giraffe {
  name: string;
  birthday: Date;
  heightInMeters: number;
}

interface TypeInfo extends GiraphQLSchemaTypes.DefaultTypeInfo {
  Object: {
    Giraffe: Giraffe;
  };
}

const builder = new SchemaBuilder<TypeInfo>();

const LengthUnit = builder.enumType('LengthUnit', {
  values: { Feet: {}, Meters: {} },
});

builder.objectType('Giraffe', {
  description: 'Long necks, cool patterns, taller than you.',
  shape: t => ({
    name: t.exposeString('name', {}),
    age: t.int({
      resolve: parent => {
        const today = new Date(new Date().toDateString());
        const birthday = new Date(parent.birthday.toDateString());
        const ageDifMs = Number(today) - Number(birthday);
        const ageDate = new Date(ageDifMs);

        return Math.abs(ageDate.getUTCFullYear() - 1970);
      },
    }),
    height: t.float({
      args: {
        unit: t.arg(LengthUnit, {
          required: true,
          default: 'Meters',
        }),
      },
      resolve: (parent, args) =>
        args.unit === 'Feet' ? parent.heightInMeters * 3.281 : parent.heightInMeters,
    }),
  }),
});

builder.queryType({
  shape: t => ({
    giraffe: t.field({
      type: 'Giraffe',
      resolve: () => ({ name: 'James', heightInMeters: 5.2, birthday: new Date(2012, 11, 12) }),
    }),
  }),
});

const schema = builder.toSchema();

export default schema;
