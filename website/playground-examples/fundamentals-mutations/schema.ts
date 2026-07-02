import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: number;
  name: string;
  biography: string;
  editorId: number;
}

const Characters = new Map<number, ICharacter>([
  [1, { id: 1, name: 'Frodo Baggins', biography: 'Bearer of the One Ring.', editorId: 1 }],
]);

interface Context {
  user?: { id: number };
}

const builder = new SchemaBuilder<{
  Context: Context;
}>({});

const Character = builder.objectRef<ICharacter>('Character');

Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    biography: t.exposeString('biography'),
  }),
});

builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: [Character],
      resolve: () => [...Characters.values()],
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    updateCharacter: t.field({
      type: Character,
      args: {
        input: t.arg({
          type: builder.inputType('UpdateCharacterInput', {
            fields: (t) => ({
              characterId: t.id({ required: true }),
              biography: t.string({ required: true }),
            }),
          }),
          required: true,
        }),
      },
      resolve: (_root, { input }, ctx) => {
        if (!ctx.user) {
          throw new Error('Not signed in');
        }
        const entry = Characters.get(Number(input.characterId));
        if (!entry) {
          throw new Error(`No character with id ${input.characterId}`);
        }
        if (entry.editorId !== ctx.user.id) {
          throw new Error("Only the entry's editor can edit it");
        }
        entry.biography = input.biography;
        return entry;
      },
    }),
  }),
});

export const schema = builder.toSchema();
