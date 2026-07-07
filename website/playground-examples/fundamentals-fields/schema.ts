import SchemaBuilder from '@pothos/core';

// Third Age year the War of the Ring began, used to age characters.
const REFERENCE_YEAR = 3018;

interface CharacterModel {
  id: string;
  name: string;
  birthYear: number;
  biography?: string;
  titles: string[];
  factionId: string;
}

interface FactionModel {
  id: string;
  name: string;
}

const factions: Record<string, FactionModel> = {
  '1': { id: '1', name: 'Fellowship of the Ring' },
};

const characters: CharacterModel[] = [
  {
    id: '1',
    name: 'Frodo Baggins',
    birthYear: 2968,
    biography: 'Bearer of the One Ring on the quest to destroy it.',
    titles: ['Ring-bearer'],
    factionId: '1',
  },
  {
    id: '2',
    name: 'Aragorn',
    birthYear: 2931,
    titles: ['Strider', 'Elessar', 'King of Gondor'],
    factionId: '1',
  },
];

const builder = new SchemaBuilder({});

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
    faction: t.field({
      type: Faction,
      resolve: (character) => factions[character.factionId],
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
builder.objectField(Faction, 'members', (t) =>
  t.field({
    type: [Character],
    resolve: (faction) =>
      characters.filter((character) => character.factionId === faction.id),
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
