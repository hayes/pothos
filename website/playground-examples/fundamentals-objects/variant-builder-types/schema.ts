import SchemaBuilder from '@pothos/core';

interface IRace {
  id: string;
  name: string;
  lifespan: string;
}

const Races = new Map<string, IRace>([
  ['hobbit', { id: 'hobbit', name: 'Hobbit', lifespan: '~100 years' }],
  ['elf', { id: 'elf', name: 'Elf', lifespan: 'immortal' }],
  ['dwarf', { id: 'dwarf', name: 'Dwarf', lifespan: '~250 years' }],
]);

// Register backing models on the `Objects` generic at builder
// initialization. Every type is then referred to by name as a string.
const builder = new SchemaBuilder<{
  Objects: { Race: IRace };
}>({});

builder.objectType('Race', {
  description: 'A people of Middle-earth.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    lifespan: t.exposeString('lifespan'),
  }),
});

builder.queryType({
  fields: (t) => ({
    races: t.field({
      type: ['Race'],
      resolve: () => [...Races.values()],
    }),
  }),
});

export const schema = builder.toSchema();
