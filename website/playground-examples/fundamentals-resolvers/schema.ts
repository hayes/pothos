import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: string;
  name: string;
  birthYear?: string;
  biography?: string;
  editorId: string;
}

const characters: ICharacter[] = [
  { id: '1', name: 'Frodo Baggins', birthYear: 'TA 2968', editorId: '1' },
  { id: '2', name: 'Samwise Gamgee', birthYear: 'TA 2980', editorId: '1' },
  { id: '3', name: 'Gandalf', editorId: '2' },
];

// Stands in for a real data source such as a database
async function loadCharacter(id: string): Promise<ICharacter | undefined> {
  return characters.find((character) => character.id === id);
}

const builder = new SchemaBuilder({});

const Character = builder.objectRef<ICharacter>('Character').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    // #region count
    characterCount: t.int({
      resolve: () => characters.length,
    }),
    // #endregion count

    // #region signature
    character: t.field({
      type: Character,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (parent, args) =>
        characters.find((character) => character.id === args.id) ?? null,
    }),
    // #endregion signature

    // #region async
    featuredCharacter: t.field({
      type: Character,
      nullable: true,
      resolve: async () => {
        const character = await loadCharacter('1');
        return character ?? null;
      },
    }),
    // #endregion async

    // #region throw
    characterById: t.field({
      type: Character,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_parent, args) => {
        const character = characters.find((c) => c.id === args.id);
        if (!character) {
          throw new Error(`No character with id ${args.id}`);
        }
        return character;
      },
    }),
    // #endregion throw
  }),
});

export const schema = builder.toSchema();
