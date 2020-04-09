import builder from '../builder';
import { Episode } from './episode';
import { getFriends } from '../data';

export default builder.interfaceType('Character', {
  shape: (t) => ({
    id: t.exposeID('id', { description: 'The id of the character' }),
    name: t.exposeString('name', { description: 'The name of the character' }),
    friends: t.field({
      type: ['Character'],
      description: 'The friends of the character, or an empty list if they have none.',
      nullable: { list: false, items: true },
      resolve: (character) => {
        // Testing Promise<Promise<Character>[]> to handle complicated async cases
        return getFriends(character);
      },
    }),
    appearsIn: t.field({
      type: [Episode],
      description: 'Which movies they appear in.',
      resolve: (o) => o.appearsIn,
      args: {
        id: {
          required: true,
          type: 'ID',
        },
      },
    }),
  }),
});
