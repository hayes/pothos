import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// objectRef is the recommended way to declare an object type: it
// returns a typed reference you implement separately. The generic
// argument is the backing TypeScript shape — what every resolver
// returning a Character must produce.
const Character = builder.objectRef<{ id: string; name: string }>('Character');

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
