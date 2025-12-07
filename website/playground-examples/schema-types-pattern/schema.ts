import SchemaBuilder from '@pothos/core';

// Define TypeScript interface for your data
interface GiraffeType {
  name: string;
  birthday: Date;
  heightInMeters: number;
}

// Map type names to TypeScript types in SchemaBuilder
const builder = new SchemaBuilder<{ Objects: { Giraffe: GiraffeType } }>({});

builder.objectType('Giraffe', {
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({
    name: t.exposeString('name', {}),
    birthday: t.field({
      type: 'String',
      resolve: (parent) => parent.birthday.toISOString(),
    }),
    height: t.exposeFloat('heightInMeters', {}),
    age: t.int({
      resolve: (parent) => {
        const ageDifMs = Date.now() - parent.birthday.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
      },
    }),
  }),
});

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
