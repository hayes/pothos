import SchemaBuilder from '@pothos/core';

// Third Age year the War of the Ring began, used to age characters.
const REFERENCE_YEAR = 3018;

interface CharacterModel {
  id: string;
  name: string;
  birthYear: number;
  biography?: string;
  titles: string[];
  raceId: string;
}

interface RaceModel {
  id: string;
  name: string;
}

interface FactionModel {
  id: string;
  name: string;
}

const races: Record<string, RaceModel> = {
  '1': { id: '1', name: 'Hobbit' },
  '2': { id: '2', name: 'Dúnedain' },
};

const factions: Record<string, FactionModel> = {
  '1': { id: '1', name: 'Fellowship of the Ring' },
};

const factionsByCharacter: Record<string, string[]> = {
  '1': ['1'],
  '2': ['1'],
};

const characters: CharacterModel[] = [
  {
    id: '1',
    name: 'Frodo Baggins',
    birthYear: 2968,
    biography: 'Bearer of the One Ring on the quest to destroy it.',
    titles: ['Ring-bearer'],
    raceId: '1',
  },
  {
    id: '2',
    name: 'Aragorn',
    birthYear: 2931,
    titles: ['Strider', 'Elessar', 'King of Gondor'],
    raceId: '2',
  },
];

const builder = new SchemaBuilder({});

const Race = builder.objectRef<RaceModel>('Race').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

const Faction = builder.objectRef<FactionModel>('Faction').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

const Character = builder.objectRef<CharacterModel>('Character');

Character.implement({
  fields: (t) => ({
    // #region field
    race: t.field({
      type: Race,
      resolve: (character) => races[character.raceId],
    }),
    // #endregion field

    // #region scalar
    age: t.int({
      resolve: (character) => REFERENCE_YEAR - character.birthYear,
    }),
    // #endregion scalar

    // #region expose
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    bio: t.exposeString('biography'),
    // #endregion expose

    // #region list
    titles: t.exposeStringList('titles'),
    // #endregion list
  }),
});

// #region split
builder.objectField(Character, 'factions', (t) =>
  t.field({
    type: [Faction],
    resolve: (character) =>
      (factionsByCharacter[character.id] ?? []).map((id) => factions[id]),
  }),
);
// #endregion split

builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: [Character],
      resolve: () => characters,
    }),
  }),
});

export const schema = builder.toSchema();
