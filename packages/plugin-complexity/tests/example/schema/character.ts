import type { Character } from '../backing-models';
import builder from '../builder';
import { getFriends } from '../data';
import { Episode } from './episode';

export const CharacterRef = builder.interfaceRef<Character>('Character');

CharacterRef.implement({
  fields: (t) => ({
    id: t.exposeID('id', {
      description: 'The id of the character',
    }),
    name: t.exposeString('name', {
      description: 'The name of the character',
    }),
    friends: t.field({
      type: [CharacterRef],
      description: 'The friends of the character, or an empty list if they have none.',
      nullable: { list: false, items: true },
      args: {
        limit: t.arg.int(),
      },
      complexity: (args) => ({ multiplier: args.limit ?? 5 }),
      resolve: (character, args) =>
        // Testing Promise<Promise<Character>[]> to handle complicated async cases
        getFriends(character).slice(0, args.limit ?? 5),
    }),
    appearsIn: t.field({
      type: [Episode],
      description: 'Which movies they appear in.',
      resolve: (o) => o.appearsIn,
    }),
  }),
});
