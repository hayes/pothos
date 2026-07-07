// #region schema
import SchemaBuilder from '@pothos/core';

// #region builder
const builder = new SchemaBuilder({});
// #endregion builder

// Character is backed by the TypeScript shape in the generic
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
      resolve: () => ({ id: '1', name: 'Frodo Baggins' }),
    }),
  }),
});
// #endregion character-and-query

export const schema = builder.toSchema();
// #endregion schema
