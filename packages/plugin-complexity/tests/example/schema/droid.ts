import type { Droid } from '../backing-models';
import builder from '../builder';
import { CharacterRef } from './character';

export const DroidRef = builder.objectRef<Droid>('Droid').implement({
  description: 'A mechanical creature in the Star Wars universe.',
  interfaces: [CharacterRef],
  isTypeOf: (item) => (item as { type: string }).type === 'Droid',
  fields: (t) => ({
    primaryFunction: t.string({
      description: 'The primary function of the droid.',
      resolve: (o) => o.primaryFunc || 'N/A',
    }),
  }),
});
