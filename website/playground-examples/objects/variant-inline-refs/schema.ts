// #region model
import SchemaBuilder from '@pothos/core';

interface Giraffe {
  name: string;
  birthday: Date;
  heightInMeters: number;
}

const builder = new SchemaBuilder({});

// #endregion model

// #region fields
const GiraffeRef = builder.objectRef<Giraffe>('Giraffe').implement({
  description: 'A giraffe in the zoo.',
  fields: (t) => ({
    name: t.exposeString('name'),
    height: t.exposeFloat('heightInMeters'),
    birthYear: t.int({
      resolve: (giraffe) => giraffe.birthday.getUTCFullYear(),
    }),
  }),
});
// #endregion fields

// #region query
builder.queryType({
  fields: (t) => ({
    giraffe: t.field({
      type: GiraffeRef,
      resolve: () => ({
        name: 'James',
        birthday: new Date(Date.UTC(2012, 11, 12)),
        heightInMeters: 5.2,
      }),
    }),
  }),
});

export const schema = builder.toSchema();
// #endregion query
