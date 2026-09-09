import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: string;
  name: string;
  raceId: string;
}

interface IRace {
  id: string;
  name: string;
}

const Races = new Map<string, IRace>([
  ['hobbit', { id: 'hobbit', name: 'Hobbit' }],
  ['elf', { id: 'elf', name: 'Elf' }],
]);

const Characters: ICharacter[] = [
  { id: 'frodo', name: 'Frodo Baggins', raceId: 'hobbit' },
  { id: 'legolas', name: 'Legolas', raceId: 'elf' },
];

// #region single-file
const builder = new SchemaBuilder({});

const Race = builder.objectRef<IRace>('Race').implement({
  fields: (t) => ({ id: t.exposeID('id'), name: t.exposeString('name') }),
});

const Character = builder.objectRef<ICharacter>('Character').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    race: t.field({ type: Race, resolve: (c) => Races.get(c.raceId)! }),
  }),
});

builder.queryType({
  fields: (t) => ({
    characters: t.field({ type: [Character], resolve: () => Characters }),
    races: t.field({ type: [Race], resolve: () => [...Races.values()] }),
  }),
});

export const schema = builder.toSchema();
// #endregion single-file
