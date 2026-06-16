import { builder } from '../builder.ts';
import { Battles, Characters, Factions, type IFaction } from '../data/canon.ts';
import { Battle } from './battle.ts';
import { Character } from './character.ts';

export const Alignment = builder.enumType('Alignment', {
  values: ['Good', 'Evil', 'Neutral'] as const,
});

export const Faction = builder.objectRef<IFaction>('Faction');

Faction.implement({
  description: 'A group, order, or army — formal or informal.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    alignment: t.field({
      type: Alignment,
      resolve: (f) => f.alignment,
    }),
    leaderName: t.exposeString('leaderName', {
      description:
        "The leader's name as a plain string — useful for leaders without a Character record (e.g. Sauron).",
    }),
    leader: t.field({
      description: 'The leader as a Character, if we have a record for them.',
      type: Character,
      nullable: true,
      resolve: (f) => (f.leaderId ? (Characters.get(f.leaderId) ?? null) : null),
    }),
    members: t.field({
      type: [Character],
      resolve: (f) => [...Characters.values()].filter((c) => c.factionIds.includes(f.id)),
    }),
    battles: t.field({
      description: 'Battles this faction is recorded as taking part in.',
      type: [Battle],
      resolve: (f) => [...Battles.values()].filter((b) => b.factionIds.includes(f.id)),
    }),
  }),
});

builder.queryFields((t) => ({
  factions: t.field({
    type: [Faction],
    resolve: () => [...Factions.values()],
  }),
  faction: t.field({
    type: Faction,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => Factions.get(String(id)) ?? null,
  }),
}));
