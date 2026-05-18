import SchemaBuilder from '@pothos/core';

// Backing type for an object type. This is what every resolver
// returning a Character will actually produce.
interface ICharacter {
  id: string;
  name: string;
}

const builder = new SchemaBuilder({});

// objectRef is the recommended way to declare an object type: it
// returns a typed reference you implement separately.
const Character = builder.objectRef<ICharacter>('Character');

Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    frodo: t.field({
      type: Character,
      resolve: () => ({ id: 'frodo', name: 'Frodo Baggins' }),
    }),
  }),
});

export const schema = builder.toSchema();
