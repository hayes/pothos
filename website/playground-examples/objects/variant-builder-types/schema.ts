import SchemaBuilder from '@pothos/core';

interface Giraffe {
  name: string;
  birthday: Date;
  heightInMeters: number;
}

// #region definition
interface SchemaTypes {
  Objects: { Giraffe: Giraffe };
}
const builder = new SchemaBuilder<SchemaTypes>({});
builder.objectType('Giraffe', {
  fields: (t) => ({
    name: t.exposeString('name'),
    height: t.exposeFloat('heightInMeters'),
    birthYear: t.int({
      resolve: (giraffe) => giraffe.birthday.getUTCFullYear(),
    }),
  }),
});
// #endregion definition

builder.queryType({
  fields: (t) => ({
    giraffe: t.field({
      type: 'Giraffe',
      resolve: () => ({
        name: 'James',
        birthday: new Date(Date.UTC(2012, 11, 12)),
        heightInMeters: 5.2,
      }),
    }),
  }),
});

export const schema = builder.toSchema();
