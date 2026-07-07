import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: string;
  name: string;
}

const Characters: ICharacter[] = [
  { id: '1', name: 'Frodo Baggins' },
  { id: '2', name: 'Samwise Gamgee' },
  { id: '3', name: 'Aragorn' },
];

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
    // Single character by id.
    character: t.field({
      type: Character,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, { id }) => Characters.find((c) => c.id === String(id)) ?? null,
    }),

    // All characters.
    characters: t.field({
      type: [Character],
      resolve: () => Characters,
    }),
  }),
});

export const schema = builder.toSchema();
