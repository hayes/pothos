import SchemaBuilder from '@pothos/core';

// #region character-model
interface ICharacter {
  id: string;
  name: string;
  birthYear?: string;
  biography?: string;
  editorId: string;
}
// #endregion character-model

const characters: ICharacter[] = [
  { id: '1', name: 'Frodo Baggins', birthYear: 'TA 2968', editorId: '1' },
  { id: '2', name: 'Samwise Gamgee', birthYear: 'TA 2980', editorId: '1' },
  { id: '3', name: 'Gandalf', editorId: '2' },
];

// #region builder-init
const builder = new SchemaBuilder<{
  Objects: { Character: ICharacter };
}>({});
// #endregion builder-init

// #region object-type
builder.objectType('Character', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});
// #endregion object-type

builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: ['Character'],
      resolve: () => characters,
    }),
  }),
});

export const schema = builder.toSchema();
