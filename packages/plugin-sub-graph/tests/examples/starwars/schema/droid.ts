import builder from '../builder';
import Character from './character';

export default builder.objectType('Droid', {
  subGraphs: ['Private', 'Public'],
  description: 'A mechanical creature in the Star Wars universe.',
  interfaces: [Character],
  isTypeOf: (item) => item.type === 'Droid',
  fields: (t) => ({
    primaryFunction: t.string({
      description: 'The primary function of the droid.',
      resolve: (o) => o.primaryFunc || 'N/A',
    }),
  }),
});
