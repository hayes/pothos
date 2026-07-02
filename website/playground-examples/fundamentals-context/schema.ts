import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: number;
  name: string;
}

const Characters = new Map<number, ICharacter>([
  [1, { id: 1, name: 'Frodo Baggins' }],
  [2, { id: 2, name: 'Samwise Gamgee' }],
]);

// The Context shape is whatever your server attaches to every request.
// A typical one threads the authenticated viewer (if any) and any data
// sources the resolvers need.
interface Context {
  viewer?: { id: number };
  db: {
    characters: { find: (id: number) => ICharacter | null };
  };
}

const builder = new SchemaBuilder<{
  Context: Context;
}>({});

const Character = builder.objectRef<ICharacter>('Character');

Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.field({
      type: Character,
      nullable: true,
      resolve: (_root, _args, ctx) => (ctx.viewer ? ctx.db.characters.find(ctx.viewer.id) : null),
    }),
  }),
});

export const schema = builder.toSchema();
