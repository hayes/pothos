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

const builder = new SchemaBuilder({});

// objectRef defers the field definition so types that reference each
// other can be declared in any order. The generic argument is the
// backing shape — what every resolver returns for this type.
const Race = builder.objectRef<IRace>('Race');

Race.implement({
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
      type: [Race],
      resolve: () => [...Races.values()],
    }),
  }),
});

export const schema = builder.toSchema();
