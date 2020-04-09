import Character from './character';
import builder from '../builder';

export default builder.objectType('Droid', {
  description: 'A mechanical creature in the Star Wars universe.',
  implements: [Character],
  isType: (item) => item.type === 'Droid',
  shape: (t) => ({
    primaryFunction: t.string({
      description: 'The primary function of the droid.',
      resolve: (o) => o.primaryFunc || 'N/A',
    }),
  }),
});
