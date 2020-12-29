import builder from '../builder';
import { Episode } from './episode';
import { getFriends } from '../data';

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
         getFriends(character)
      ,
    }),
    appearsIn: t.field({
      type: [Episode],
      subGraphs: [],
      description: 'Which movies they appear in.',
      resolve: (o) => o.appearsIn,
    }),
  }),
});
