import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

interface IRace {
  id: string;
  name: string;
  lifespan: string;
}

const Race = builder.objectRef<IRace>('Race').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    lifespan: t.exposeString('lifespan'),
  }),
});

const RaceFilter = builder.inputType('RaceFilter', {
  fields: (t) => ({
    nameContains: t.string(),
    immortal: t.boolean(),
  }),
});

// $inferType gives you the TypeScript type of a Pothos ref's output.
// $inferInput does the same for input objects. Useful when building
// utility functions, fixtures, or anything that needs the same shape
// the resolver sees.
type RaceShape = typeof Race.$inferType;
type RaceFilterShape = typeof RaceFilter.$inferInput;

function matches(race: RaceShape, filter: RaceFilterShape): boolean {
  if (filter.nameContains && !race.name.toLowerCase().includes(filter.nameContains.toLowerCase())) {
    return false;
  }
  if (filter.immortal != null && (race.lifespan === 'immortal') !== filter.immortal) {
    return false;
  }
  return true;
}

const Races: RaceShape[] = [
  { id: 'hobbit', name: 'Hobbit', lifespan: '~100 years' },
  { id: 'elf', name: 'Elf', lifespan: 'immortal' },
];

builder.queryType({
  fields: (t) => ({
    races: t.field({
      type: [Race],
      args: { filter: t.arg({ type: RaceFilter }) },
      resolve: (_root, { filter }) => (filter ? Races.filter((r) => matches(r, filter)) : Races),
    }),
  }),
});

export const schema = builder.toSchema();
