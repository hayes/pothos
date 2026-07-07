import { builder } from '../builder.ts';
import { Characters, type IRace, Locations, Races } from '../data/canon.ts';
import { Character } from './character.ts';
import { Location } from './location.ts';

export const Race = builder.objectRef<IRace>('Race');

Race.implement({
  description: 'A people of Middle-earth (Hobbits, Elves, Men, Dwarves, Wizards, Orcs).',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    lifespan: t.exposeString('lifespan'),
    originLocation: t.field({
      type: Location,
      nullable: true,
      resolve: (race) =>
        race.originLocationId ? (Locations.get(race.originLocationId) ?? null) : null,
    }),
    members: t.field({
      type: [Character],
      resolve: (race) => [...Characters.values()].filter((c) => c.raceId === race.id),
    }),
  }),
});

builder.queryFields((t) => ({
  races: t.field({
    type: [Race],
    resolve: () => [...Races.values()],
  }),
  race: t.field({
    type: Race,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => Races.get(String(id)) ?? null,
  }),
}));
