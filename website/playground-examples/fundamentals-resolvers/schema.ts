import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: string;
  name: string;
}

const Characters = new Map<string, ICharacter>([
  ['frodo', { id: 'frodo', name: 'Frodo Baggins' }],
  ['gandalf', { id: 'gandalf', name: 'Gandalf' }],
]);

const builder = new SchemaBuilder({});

const Character = builder.objectRef<ICharacter>('Character');

Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Sync resolver: just return the value.
    characterCount: t.int({
      resolve: () => Characters.size,
    }),

    // Async resolver: return a Promise. Pothos awaits it for you.
    randomCharacter: t.field({
      type: Character,
      resolve: async () => {
        const list = [...Characters.values()];
        return list[Math.floor(Math.random() * list.length)];
      },
    }),

    // Throwing resolver: errors propagate as null for the field and
    // an entry in the response's `errors` array.
    // #region character-by-id-field
    characterById: t.field({
      type: Character,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, { id }) => {
        const character = Characters.get(String(id));
        if (!character) {
          throw new Error(`No character with id ${id}`);
        }
        return character;
      },
    }),
    // #endregion character-by-id-field
  }),
});

export const schema = builder.toSchema();
