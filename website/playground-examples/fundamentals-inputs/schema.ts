import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: number;
  name: string;
  age: number;
}

const Characters = new Map<number, ICharacter>();
let nextId = 1;

function recruitCharacter(name: string, age: number): ICharacter {
  const character: ICharacter = { id: nextId++, name, age };
  Characters.set(character.id, character);
  return character;
}

const builder = new SchemaBuilder({});

const Character = builder.objectRef<ICharacter>('Character');

Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    age: t.exposeInt('age'),
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
    recruitCharacter: t.field({
      type: Character,
      args: {
        input: t.arg({
          type: builder.inputType('RecruitCharacterInput', {
            fields: (t) => ({
              name: t.string({ required: true }),
              age: t.int({ required: true }),
            }),
          }),
          required: true,
        }),
      },
      resolve: (_root, { input }) => recruitCharacter(input.name, input.age),
    }),
  }),
});

export const schema = builder.toSchema();
