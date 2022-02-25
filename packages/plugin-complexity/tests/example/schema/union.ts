import builder from '../builder';
import { getFriends } from '../data';
import { CharacterRef } from './character';
import { DroidRef } from './droid';
import { HumanRef } from './human';

export const Friends = builder.unionType('Friend', { types: [HumanRef, DroidRef] });

builder.interfaceField(CharacterRef, 'friendsUnion', (t) =>
  t.field({
    type: [Friends],
    description: 'The friends of the character, or an empty list if they have none.',
    nullable: { list: false, items: true },
    args: {
      limit: t.arg.int(),
    },
    complexity: (args) => ({ multiplier: args.limit ?? 5 }),
    resolve: (character, args) =>
      // Testing Promise<Promise<Character>[]> to handle complicated async cases
      getFriends(character).slice(0, args.limit ?? 5),
  }),
);
