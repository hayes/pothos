import Character from './character';
import builder from '../builder';

export default builder.createObjectType('Human', {
  description: 'A humanoid creature in the Star Wars universe.',
  implements: [Character],
  test: item => item.type === 'Human',
  shape: t => ({
    homePlanet: t.string({
      description: 'The home planet of the human, or null if unknown.',
      required: false,
      resolver: o => o.characterHomePlanet || null,
    }),
  }),
});
