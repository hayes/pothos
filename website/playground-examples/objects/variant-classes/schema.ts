import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region definition
class Giraffe {
  constructor(
    public name: string,
    public birthday: Date,
    public heightInMeters: number,
  ) {}
}

builder.objectType(Giraffe, {
  name: 'Giraffe',
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
      type: Giraffe,
      resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
    }),
  }),
});
export const schema = builder.toSchema();
