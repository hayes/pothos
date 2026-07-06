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

const builder = new SchemaBuilder({});

// objectRef defers the field definition so types that reference each
// other can be declared in any order. The generic argument is the
// backing shape — what every resolver returns for this type.
// #region race-ref
const Race = builder.objectRef<IRace>('Race');
// #endregion race-ref

// #region race-implement
Race.implement({
  description: 'A people of Middle-earth.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    lifespan: t.exposeString('lifespan'),
  }),
});
// #endregion race-implement

builder.queryType({
  fields: (t) => ({
    races: t.field({
      type: [Race],
      resolve: () => [...Races.values()],
    }),
  }),
});

export const schema = builder.toSchema();
