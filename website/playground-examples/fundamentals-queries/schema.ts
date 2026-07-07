// #region imports
import SchemaBuilder from '@pothos/core';
// #endregion imports

// #region builder
const builder = new SchemaBuilder({});
// #endregion builder

// A few records the compendium already has loaded.
// #region data
const characters = ['Frodo', 'Samwise', 'Gandalf', 'Aragorn'];
// #endregion data

// #region query-type
builder.queryType({
  fields: (t) => ({
    hello: t.string({
      resolve: () => 'Welcome to the compendium',
    }),
    characterCount: t.int({
      resolve: () => characters.length,
    }),
  }),
});
// #endregion query-type

// #region query-field
builder.queryField('newestEntry', (t) =>
  t.string({
    resolve: () => 'The Battle of the Pelennor Fields',
  }),
);
// #endregion query-field

// #region query-fields
builder.queryFields((t) => ({
  editorCount: t.int({
    resolve: () => 3,
  }),
  compendiumTitle: t.string({
    resolve: () => 'A Compendium of Middle-earth',
  }),
}));
// #endregion query-fields

// #region export
export const schema = builder.toSchema();
// #endregion export
