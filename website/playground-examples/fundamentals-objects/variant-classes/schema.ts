import SchemaBuilder from '@pothos/core';

// A domain class you already keep around for behaviour. Pothos infers
// the backing model straight from the class — no separate interface.
// #region race-class
class Race {
  constructor(
    public id: string,
    public name: string,
    public lifespan: string,
  ) {}
}
// #endregion race-class

const Races = new Map<string, Race>([
  ['hobbit', new Race('hobbit', 'Hobbit', '~100 years')],
  ['elf', new Race('elf', 'Elf', 'immortal')],
  ['dwarf', new Race('dwarf', 'Dwarf', '~250 years')],
]);

const builder = new SchemaBuilder({});

// objectType takes the class as its first argument; the class name
// becomes the GraphQL type name unless you override it with `name`.
// #region object-type
builder.objectType(Race, {
  name: 'Race',
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
      type: [Race],
      resolve: () => [...Races.values()],
    }),
  }),
});

export const schema = builder.toSchema();
