import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: number;
  name: string;
}

// The Context shape is whatever your server attaches to every request.
// A typical one carries the signed-in user (if any) and the data sources
// the resolvers read through.
// #region context-type
interface Context {
  user?: { id: number };
  db: {
    charactersByEditor: (editorId: number) => ICharacter[];
  };
}
// #endregion context-type

// #region builder-init
const builder = new SchemaBuilder<{
  Context: Context;
}>({});
// #endregion builder-init

const Character = builder.objectRef<ICharacter>('Character');

Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

// #region query
builder.queryType({
  fields: (t) => ({
    myCharacters: t.field({
      type: [Character],
      nullable: true,
      resolve: (_root, _args, ctx) =>
        ctx.user ? ctx.db.charactersByEditor(ctx.user.id) : null,
    }),
  }),
});
// #endregion query

export const schema = builder.toSchema();
