import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: string;
  name: string;
  factionIds: string[];
}

interface IFaction {
  id: string;
  name: string;
  memberIds: string[];
}

const characters: ICharacter[] = [
  { id: '1', name: 'Frodo Baggins', factionIds: ['1'] },
  { id: '2', name: 'Aragorn', factionIds: ['1', '2'] },
];

const factions: IFaction[] = [
  { id: '1', name: 'Fellowship of the Ring', memberIds: ['1', '2'] },
  { id: '2', name: 'Rangers of the North', memberIds: ['2'] },
];

const builder = new SchemaBuilder({});

// #region circular-refs
const Character = builder.objectRef<ICharacter>('Character');
const Faction = builder.objectRef<IFaction>('Faction');

Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    factions: t.field({
      type: [Faction],
      resolve: (c) => factions.filter((faction) => c.factionIds.includes(faction.id)),
    }),
  }),
});

Faction.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    members: t.field({
      type: [Character],
      resolve: (f) => characters.filter((character) => f.memberIds.includes(character.id)),
    }),
  }),
});
// #endregion circular-refs

builder.queryType({
  fields: (t) => ({
    characters: t.field({ type: [Character], resolve: () => characters }),
  }),
});

export const schema = builder.toSchema();
