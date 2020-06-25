import builder from './builder';

export enum Diet {
  HERBIVOROUS,
  CARNIVOROUS,
  OMNIVORIOUS,
}

builder.enumType(Diet, {
  name: 'Diet',
});

export const LengthUnit = builder.enumType('LengthUnit', {
  values: ['Feet', 'Meters'] as const,
});

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

builder.objectFields('Giraffe', (t) => ({
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
}));
