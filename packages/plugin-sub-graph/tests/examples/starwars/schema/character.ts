import { resolveArrayConnection } from '@pothos/plugin-relay';
import type { Character } from '../backing-models';
import builder from '../builder';
import { getFriends } from '../data';
import { Episode } from './episode';
import { DeprecatedInput } from './query';

export default builder.interfaceType('Character', {
  subGraphs: ['Private', 'Public'],
  fields: (t) => ({
    id: t.exposeID('id', { description: 'The id of the character', subGraphs: ['Private'] }),
    name: t.exposeString('name', { description: 'The name of the character' }),
    friends: t.field({
      type: ['Character'],
      description: 'The friends of the character, or an empty list if they have none.',
      nullable: { list: false, items: true },
      resolve: (character) =>
        // Testing Promise<Promise<Character>[]> to handle complicated async cases
        getFriends(character),
    }),
    friendsConnection: t.connection({
      type: 'Character',
      subGraphs: ['Private'],
      args: {
        deprecatedInput: t.arg({
          type: DeprecatedInput,
          required: false,
          deprecationReason: 'not a real input',
        }),
      },
      resolve: async (parent, args) =>
        resolveArrayConnection({ args }, (await Promise.all(getFriends(parent))) as Character[]),
    }),
    appearsIn: t.field({
      type: [Episode],
      subGraphs: [],
      description: 'Which movies they appear in.',
      resolve: (o) => o.appearsIn,
    }),
  }),
});
