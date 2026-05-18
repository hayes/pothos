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

const Characters = new Map<string, ICharacter>([
  ['frodo', { id: 'frodo', name: 'Frodo', factionIds: ['fellowship'] }],
  ['aragorn', { id: 'aragorn', name: 'Aragorn', factionIds: ['fellowship', 'rangers'] }],
]);

const Factions = new Map<string, IFaction>([
  ['fellowship', { id: 'fellowship', name: 'Fellowship', memberIds: ['frodo', 'aragorn'] }],
  ['rangers', { id: 'rangers', name: 'Rangers of the North', memberIds: ['aragorn'] }],
]);

const builder = new SchemaBuilder({});

// objectRef declares the type up front; implement comes later. This
// lets Character.field reference Faction and vice versa without TS
// or Pothos tripping over a circular import.
const Character = builder.objectRef<ICharacter>('Character');
const Faction = builder.objectRef<IFaction>('Faction');

Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    factions: t.field({
      type: [Faction],
      resolve: (c) => c.factionIds.map((id) => Factions.get(id)!).filter(Boolean),
    }),
  }),
});

Faction.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    members: t.field({
      type: [Character],
      resolve: (f) => f.memberIds.map((id) => Characters.get(id)!).filter(Boolean),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    characters: t.field({ type: [Character], resolve: () => [...Characters.values()] }),
  }),
});

export const schema = builder.toSchema();
