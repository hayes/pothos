import SchemaBuilder from '@pothos/core';

// #region character-class
class Character {
  constructor(
    public id: string,
    public name: string,
    public editorId: string,
    public birthYear?: string,
    public biography?: string,
  ) {}
}
// #endregion character-class

const characters = [
  new Character('1', 'Frodo Baggins', '1', 'TA 2968'),
  new Character('2', 'Samwise Gamgee', '1', 'TA 2980'),
  new Character('3', 'Gandalf', '2'),
];

const builder = new SchemaBuilder({});

// #region object-type
builder.objectType(Character, {
  name: 'Character',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});
// #endregion object-type

builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: [Character],
      resolve: () => characters,
    }),
  }),
});

export const schema = builder.toSchema();
