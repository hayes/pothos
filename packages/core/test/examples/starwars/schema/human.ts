import Character from './character';
import builder from '../builder';

export default builder.objectType('Human', {
  description: 'A humanoid creature in the Star Wars universe.',
  implements: [Character],
  isType: (item) => item.type === 'Human',
  shape: (t) => ({
    homePlanet: t.string({
      description: 'The home planet of the human, or null if unknown.',
      nullable: true,
      resolve: (o) => o.characterHomePlanet ?? null,
    }),
  }),
});
