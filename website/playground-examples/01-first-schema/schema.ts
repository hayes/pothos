import SchemaBuilder from '@pothos/core';

// Create a new SchemaBuilder instance
const builder = new SchemaBuilder({});

// Define the shape of our Giraffe type
interface Giraffe {
  name: string;
  birthday: Date;
  heightInMeters: number;
}

// Create an ObjectRef for the Giraffe type
const GiraffeRef = builder.objectRef<Giraffe>('Giraffe');

// Implement the Giraffe type with fields
GiraffeRef.implement({
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({
    // Expose the name property directly
    name: t.exposeString('name'),

    // Expose heightInMeters as "height"
    height: t.exposeFloat('heightInMeters'),

    // Computed field: calculate age from birthday
    age: t.int({
      resolve: (parent) => {
        // Calculate age from birthday
        const ageDifMs = Date.now() - parent.birthday.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
      },
    }),
  }),
});

// Create the Query type with a giraffe field
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

// Build and export the schema
export const schema = builder.toSchema();
