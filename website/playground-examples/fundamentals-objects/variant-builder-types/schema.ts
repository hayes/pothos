import SchemaBuilder from '@pothos/core';

// #region race-model
interface IRace {
  id: string;
  name: string;
  lifespan: string;
}
// #endregion race-model

const Races = new Map<string, IRace>([
  ['hobbit', { id: 'hobbit', name: 'Hobbit', lifespan: '~100 years' }],
  ['elf', { id: 'elf', name: 'Elf', lifespan: 'immortal' }],
  ['dwarf', { id: 'dwarf', name: 'Dwarf', lifespan: '~250 years' }],
]);

// Register backing models on the `Objects` generic at builder
// initialization. Every type is then referred to by name as a string.
// #region builder-init
const builder = new SchemaBuilder<{
  Objects: { Race: IRace };
}>({});
// #endregion builder-init

// #region object-type
builder.objectType('Race', {
  description: 'A people of Middle-earth.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    lifespan: t.exposeString('lifespan'),
  }),
});
// #endregion object-type

builder.queryType({
  fields: (t) => ({
    races: t.field({
      type: ['Race'],
      resolve: () => [...Races.values()],
    }),
  }),
});

export const schema = builder.toSchema();
