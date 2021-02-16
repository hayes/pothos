import builder from '../builder';
import Character from './character';

export default builder.objectType('Human', {
  description: 'A humanoid creature in the Star Wars universe.',
  interfaces: [Character],
  isTypeOf: (item) => item.type === 'Human',
  fields: (t) => ({
    homePlanet: t.string({
      description: 'The home planet of the human, or null if unknown.',
      nullable: true,
      resolve: (o) => o.characterHomePlanet ?? null,
    }),
  }),
});
