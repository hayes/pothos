import { z } from 'zod';
import { pointPlayers, points } from '../../db/schema.ts';
import { builder } from '../builder.ts';
import { db } from '../db.ts';

export const Point = builder.drizzleObject('points', {
  name: 'Point',
  fields: (t) => ({
    id: t.exposeID('id'),
    startedOnOffense: t.exposeBoolean('startedOnOffense', {
      description: "Did the scoring team start the point on offense (a 'hold')?",
    }),
    isHold: t.boolean({
      description: 'The scoring team scored while on offense.',
      select: { columns: { startedOnOffense: true } },
      resolve: (p) => p.startedOnOffense,
    }),
    isBreak: t.boolean({
      description: 'The scoring team broke (scored while starting on defense).',
      select: { columns: { startedOnOffense: true } },
      resolve: (p) => !p.startedOnOffense,
    }),
    createdAt: t.exposeString('createdAt'),
    game: t.relation('game'),
    scoringTeam: t.relation('scoringTeam'),
    players: t.relation('players', {
      description: 'Players from either team who were on the field for this point.',
    }),
  }),
});

builder.mutationFields((t) => ({
  recordPoint: t.withAuth({ loggedIn: true }).field({
    type: Point,
    description:
      'Record a scored point. Caller must be a captain of the scoring team, or an admin.',
    args: {
      gameId: t.arg.id({ required: true }),
      scoringTeamId: t.arg.id({ required: true }),
      startedOnOffense: t.arg.boolean({ required: true }),
      playerIds: t.arg.idList({
        required: true,
        validate: z.array(z.string()).min(1),
      }),
    },
    resolve: async (_root, args, ctx) => {
      const gameId = Number.parseInt(args.gameId, 10);
      const scoringTeamId = Number.parseInt(args.scoringTeamId, 10);
      const playerIds = args.playerIds.map((id) => Number.parseInt(id, 10));

      const game = await db.query.games.findFirst({ where: { id: gameId } });
      if (!game) {
        throw new Error(`No game with id ${gameId}.`);
      }
      if (game.complete) {
        throw new Error(`Game ${gameId} is already complete.`);
      }
      if (game.homeTeamId !== scoringTeamId && game.awayTeamId !== scoringTeamId) {
        throw new Error(`Team ${scoringTeamId} is not playing in game ${gameId}.`);
      }

      const isAdmin = ctx.roles.includes('admin');
      const isScoringCaptain = ctx.teamRoles.get(scoringTeamId) === 'captain';
      if (!isAdmin && !isScoringCaptain) {
        throw new Error("Only the scoring team's captain or an admin can record this point.");
      }

      // All players must be on one of the two teams playing this game.
      const validTeamIds = new Set([game.homeTeamId, game.awayTeamId]);
      const roster = await db.query.players.findMany({
        columns: { id: true, teamId: true },
        where: { id: { in: playerIds } },
      });
      const rosterById = new Map(roster.map((p) => [p.id, p]));
      for (const id of playerIds) {
        const player = rosterById.get(id);
        if (!player || !validTeamIds.has(player.teamId)) {
          throw new Error(`Player ${id} is not on either team's roster.`);
        }
      }

      const [point] = await db
        .insert(points)
        .values({ gameId, scoringTeamId, startedOnOffense: args.startedOnOffense })
        .returning();
      await db
        .insert(pointPlayers)
        .values(playerIds.map((playerId) => ({ pointId: point.id, playerId })));
      return point;
    },
  }),
}));
