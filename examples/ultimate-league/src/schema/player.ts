import { z } from 'zod';
import { players } from '../../db/schema.ts';
import { builder } from '../builder.ts';
import { db } from '../db.ts';

export const Player = builder.drizzleObject('players', {
  name: 'Player',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    jerseyNumber: t.exposeInt('jerseyNumber'),
    team: t.relation('team'),
    pointsPlayed: t.relatedCount('points'),
  }),
});

builder.queryFields((t) => ({
  player: t.drizzleField({
    type: 'players',
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      db.query.players.findFirst(query({ where: { id: Number.parseInt(args.id, 10) } })),
  }),
}));

builder.mutationFields((t) => ({
  addPlayer: t.field({
    type: Player,
    description: 'Add a roster entry to a team. Captain of that team, or admin, only.',
    authScopes: (_root, args) => ({
      $any: { admin: true, teamCaptain: Number.parseInt(args.teamId, 10) },
    }),
    args: {
      teamId: t.arg.id({ required: true }),
      name: t.arg.string({
        required: true,
        validate: z.string().trim().min(1).max(80),
      }),
      jerseyNumber: t.arg.int({
        required: true,
        validate: z.number().int().min(0).max(99),
      }),
    },
    resolve: async (_root, args) => {
      const teamId = Number.parseInt(args.teamId, 10);

      const conflict = await db.query.players.findFirst({
        columns: { id: true },
        where: { teamId, jerseyNumber: args.jerseyNumber },
      });
      if (conflict) {
        throw new Error(`Jersey #${args.jerseyNumber} is already taken on this team.`);
      }

      const [player] = await db
        .insert(players)
        .values({ teamId, name: args.name.trim(), jerseyNumber: args.jerseyNumber })
        .returning();
      return player;
    },
  }),
}));
