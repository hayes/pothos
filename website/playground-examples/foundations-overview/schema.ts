import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

const Giraffe = builder.objectRef<{ name: string; heightInMeters: number }>('Giraffe').implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    heightInFeet: t.float({
      resolve: (giraffe) => giraffe.heightInMeters * 3.28084,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    giraffe: t.field({
      type: Giraffe,
      resolve: () => ({ name: 'Gina', heightInMeters: 5 }),
    }),
  }),
});

export const schema = builder.toSchema();
