import { builder } from '../builder.ts';
import { Battles, Characters, Factions, type IBattle, Locations } from '../data/canon.ts';
import { Character } from './character.ts';
import { Faction } from './faction.ts';
import { Location } from './location.ts';

export const Battle = builder.objectRef<IBattle>('Battle');

Battle.implement({
  description: 'A military engagement during the War of the Ring (or earlier).',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    thirdAgeYear: t.exposeInt('thirdAgeYear', {
      description: 'Year in the Third Age (T.A.) when the battle took place.',
    }),
    outcome: t.exposeString('outcome'),
    location: t.field({
      type: Location,
      resolve: (b) => Locations.get(b.locationId)!,
    }),
    participants: t.field({
      type: [Character],
      resolve: (b) =>
        b.participantIds.map((id) => Characters.get(id)).filter((c) => Boolean(c)) as never,
    }),
    factions: t.field({
      type: [Faction],
      resolve: (b) => b.factionIds.map((id) => Factions.get(id)).filter((f) => Boolean(f)) as never,
    }),
  }),
});

builder.queryFields((t) => ({
  battles: t.field({
    type: [Battle],
    resolve: () => [...Battles.values()],
  }),
  battle: t.field({
    type: Battle,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => Battles.get(String(id)) ?? null,
  }),
}));
