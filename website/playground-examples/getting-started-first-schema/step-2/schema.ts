// #region schema
import SchemaBuilder from '@pothos/core';

// #region builder
const builder = new SchemaBuilder({});
// #endregion builder

// objectRef is the recommended way to declare an object type: it
// returns a typed reference you implement separately. The generic
// argument is the backing TypeScript shape — what every resolver
// returning a Character must produce.
// #region character-and-query
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
// #endregion character-and-query

export const schema = builder.toSchema();
// #endregion schema
