import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// 1. Using TypeScript enum
export enum Diet {
  HERBIVOROUS = 0,
  CARNIVOROUS = 1,
  OMNIVORIOUS = 2,
}

builder.enumType(Diet, {
  name: 'Diet',
});

// 2. Using an array of strings
export const LengthUnit = builder.enumType('LengthUnit', {
  values: ['Feet', 'Meters'] as const,
});

// 3. Using a values object
export const GiraffeSpecies = builder.enumType('GiraffeSpecies', {
  values: {
    Southern: {
      description: 'Also known as two-horned giraffe',
      value: 'giraffa',
    },
    Masai: {
      value: 'tippelskirchi',
    },
    Reticulated: {
      value: 'reticulata',
    },
    Northern: {
      value: 'camelopardalis',
    },
  } as const,
});

// Giraffe type using enums
const Giraffe = builder.objectRef<{
  name: string;
  heightInMeters: number;
}>('Giraffe');

Giraffe.implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    height: t.float({
      args: {
        unit: t.arg({
          type: LengthUnit,
          required: true,
          defaultValue: 'Meters',
        }),
      },
      resolve: (parent, args) =>
        args.unit === 'Meters' ? parent.heightInMeters : parent.heightInMeters * 3.281,
    }),
    diet: t.field({
      description:
        'While Giraffes are herbivores, they do eat the bones of dead animals to get extra calcium',
      type: Diet,
      resolve: () => Diet.HERBIVOROUS,
    }),
    species: t.field({
      type: GiraffeSpecies,
      resolve: () => 'camelopardalis' as const,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    giraffe: t.field({
      type: Giraffe,
      resolve: () => ({
        name: 'James',
        heightInMeters: 5.2,
      }),
    }),
  }),
});

export const schema = builder.toSchema();
