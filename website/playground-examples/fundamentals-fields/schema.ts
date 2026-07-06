import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: string;
  name: string;
  birthYear: number;
  titles: string[];
  shireAddress?: string;
}

const Characters: ICharacter[] = [
  {
    id: 'frodo',
    name: 'Frodo Baggins',
    birthYear: 2968,
    titles: ['Ring-bearer'],
    shireAddress: 'Bag End',
  },
  {
    id: 'aragorn',
    name: 'Aragorn',
    birthYear: 2931,
    titles: ['Strider', 'Elessar', 'King of Gondor'],
  },
];

const builder = new SchemaBuilder({});

const Character = builder.objectRef<ICharacter>('Character');

// #region character-fields
Character.implement({
  fields: (t) => ({
    // exposeX maps directly to a property on the backing object.
    id: t.exposeID('id'),
    name: t.exposeString('name'),

    // Lists, nullable, and renamed exposes all live in the options arg.
    titles: t.exposeStringList('titles'),
    shireAddress: t.exposeString('shireAddress', { nullable: true }),

    // Computed fields use the same t.<scalar>() shape but with a
    // resolve function. parent is the backing object.
    ageInYears: t.int({
      description: 'Years since birth, counted from the present.',
      resolve: (parent) => new Date().getFullYear() - parent.birthYear,
    }),
  }),
});
// #endregion character-fields

builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: [Character],
      resolve: () => Characters,
    }),
  }),
});

export const schema = builder.toSchema();
