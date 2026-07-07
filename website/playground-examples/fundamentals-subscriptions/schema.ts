import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: number;
  name: string;
  biography: string;
  editorId: number;
}

// The handle the server puts on context. In a real app this is
// graphql-yoga's createPubSub() (or a Redis-backed one for many processes).
interface PubSub {
  publish(topic: 'CHARACTER_ADDED', payload: ICharacter): void;
  subscribe(topic: 'CHARACTER_ADDED'): AsyncIterableIterator<ICharacter>;
}

interface Context {
  user?: { id: number };
  pubSub: PubSub;
}

const Characters = new Map<number, ICharacter>([
  [1, { id: 1, name: 'Frodo Baggins', biography: 'Bearer of the One Ring.', editorId: 1 }],
]);

const builder = new SchemaBuilder<{ Context: Context }>({});

const Character = builder.objectRef<ICharacter>('Character').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    biography: t.exposeString('biography'),
  }),
});

builder.queryType({
  fields: (t) => ({
    characterCount: t.int({ resolve: () => Characters.size }),
  }),
});

// #region add-character-mutation
builder.mutationType({
  fields: (t) => ({
    addCharacter: t.field({
      type: Character,
      args: { name: t.arg.string({ required: true }) },
      resolve: (_root, { name }, ctx) => {
        if (!ctx.user) {
          throw new Error('Sign in to add a character');
        }
        const character: ICharacter = {
          id: Characters.size + 1,
          name,
          biography: '',
          editorId: ctx.user.id,
        };
        Characters.set(character.id, character);
        ctx.pubSub.publish('CHARACTER_ADDED', character);
        return character;
      },
    }),
  }),
});
// #endregion add-character-mutation

// #region character-added-subscription
builder.subscriptionType({
  fields: (t) => ({
    characterAdded: t.field({
      type: Character,
      subscribe: (_root, _args, ctx) => ctx.pubSub.subscribe('CHARACTER_ADDED'),
      resolve: (character) => character,
    }),
  }),
});
// #endregion character-added-subscription

export const schema = builder.toSchema();
