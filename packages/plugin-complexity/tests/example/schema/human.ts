import type { Human } from '../backing-models';
import builder from '../builder';
import { CharacterRef } from './character';

export const HumanRef = builder.objectRef<Human>('Human').implement({
  description: 'A humanoid creature in the Star Wars universe.',
  interfaces: [CharacterRef],
  isTypeOf: (item) => (item as { type: string }).type === 'Human',
  fields: (t) => ({
    homePlanet: t.string({
      description: 'The home planet of the human, or null if unknown.',
      nullable: true,
      resolve: (o) => o.characterHomePlanet ?? null,
    }),
  }),
});
