import builder from '../builder';
import { getFriends } from '../data';
import { Episode } from './episode';

export default builder.interfaceType('Character', {
  fields: (t) => ({
    id: t.exposeID('id', {
      description: 'The id of the character',
      exampleRequiredOptionFromPlugin: true,
    }),
    name: t.exposeString('name', {
      description: 'The name of the character',
      exampleRequiredOptionFromPlugin: true,
    }),
    friends: t.field({
      exampleRequiredOptionFromPlugin: true,
      type: ['Character'],
      description: 'The friends of the character, or an empty list if they have none.',
      nullable: { list: false, items: true },
      resolve: (character) =>
        // Testing Promise<Promise<Character>[]> to handle complicated async cases
        getFriends(character),
    }),
    appearsIn: t.field({
      exampleRequiredOptionFromPlugin: true,
      type: [Episode],
      description: 'Which movies they appear in.',
      resolve: (o) => o.appearsIn,
    }),
  }),
  resolveType: (character) => character.type,
});
