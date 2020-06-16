import Character from './character';
import builder from '../builder';

export default builder.objectType('Human', {
  description: 'A humanoid creature in the Star Wars universe.',
  interfaces: [Character],
  isType: (item) => item.type === 'Human',
  fields: (t) => ({
    homePlanet: t.string({
      description: 'The home planet of the human, or null if unknown.',
      nullable: true,
      resolve: (o) => o.characterHomePlanet ?? null,
    }),
  }),
});
