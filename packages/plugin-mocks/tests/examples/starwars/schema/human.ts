import { builder } from '../builder';
import { Character } from './character';

export const Human = builder.objectType('Human', {
  description: 'A humanoid creature in the Star Wars universe.',
  interfaces: [Character],
  isTypeOf: (item) => (item as { type: string }).type === 'Human',
  fields: (t) => ({
    homePlanet: t.string({
      description: 'The home planet of the human, or null if unknown.',
      nullable: true,
      resolve: (o) => o.characterHomePlanet ?? null,
    }),
  }),
});
