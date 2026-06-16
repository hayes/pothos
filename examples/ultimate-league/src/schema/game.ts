import { and, count, eq } from 'drizzle-orm';
import { games, points } from '../../db/schema.ts';
import { builder } from '../builder.ts';
import { db } from '../db.ts';

export const Game = builder.drizzleObject('games', {
  name: 'Game',
  fields: (t) => ({
    id: t.exposeID('id'),
    complete: t.exposeBoolean('complete'),
    createdAt: t.exposeString('createdAt'),
    homeTeam: t.relation('homeTeam'),
    awayTeam: t.relation('awayTeam'),
    points: t.relation('points', { query: { orderBy: { id: 'asc' } } }),
    homeScore: t.int({
      description: 'Number of points scored by the home team.',
      select: { columns: { homeTeamId: true } },
      resolve: async (game) => {
        const [row] = await db
          .select({ count: count() })
          .from(points)
          .where(and(eq(points.gameId, game.id), eq(points.scoringTeamId, game.homeTeamId)));
        return row?.count ?? 0;
      },
    }),
    awayScore: t.int({
      description: 'Number of points scored by the away team.',
      select: { columns: { awayTeamId: true } },
      resolve: async (game) => {
        const [row] = await db
          .select({ count: count() })
          .from(points)
          .where(and(eq(points.gameId, game.id), eq(points.scoringTeamId, game.awayTeamId)));
        return row?.count ?? 0;
      },
    }),
  }),
});

builder.queryFields((t) => ({
  games: t.drizzleField({
    type: ['games'],
    args: { teamId: t.arg.id() },
    resolve: (query, _root, args) =>
      db.query.games.findMany(
        query({
          where: args.teamId
            ? {
                OR: [
                  { homeTeamId: Number.parseInt(args.teamId, 10) },
                  { awayTeamId: Number.parseInt(args.teamId, 10) },
                ],
              }
            : undefined,
          orderBy: { id: 'desc' },
        }),
      ),
  }),
  game: t.drizzleField({
    type: 'games',
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      db.query.games.findFirst(query({ where: { id: Number.parseInt(args.id, 10) } })),
  }),
}));

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  createGame: t.withAuth({ loggedIn: true }).field({
    type: Game,
    description:
      'Schedule a game between two teams. Caller must be a captain of either team, or an admin.',
    args: {
      homeTeamId: t.arg.id({ required: true }),
      awayTeamId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const homeTeamId = Number.parseInt(args.homeTeamId, 10);
      const awayTeamId = Number.parseInt(args.awayTeamId, 10);
      if (homeTeamId === awayTeamId) {
        throw new Error('A game must be played between two different teams.');
      }
      const isAdmin = ctx.roles.includes('admin');
      const isHomeCaptain = ctx.teamRoles.get(homeTeamId) === 'captain';
      const isAwayCaptain = ctx.teamRoles.get(awayTeamId) === 'captain';
      if (!isAdmin && !isHomeCaptain && !isAwayCaptain) {
        throw new Error('Only a captain of either team or an admin can create this game.');
      }
      const [game] = await db
        .insert(games)
        .values({ homeTeamId, awayTeamId, complete: false })
        .returning();
      return game;
    },
  }),

  completeGame: t.withAuth({ loggedIn: true }).field({
    type: Game,
    description: 'Mark a game complete. Captain of either team, or admin.',
    args: { gameId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx) => {
      const gameId = Number.parseInt(args.gameId, 10);
      const game = await db.query.games.findFirst({ where: { id: gameId } });
      if (!game) {
        throw new Error(`No game with id ${gameId}.`);
      }

      const isAdmin = ctx.roles.includes('admin');
      const isCaptain =
        ctx.teamRoles.get(game.homeTeamId) === 'captain' ||
        ctx.teamRoles.get(game.awayTeamId) === 'captain';
      if (!isAdmin && !isCaptain) {
        throw new Error('Only a captain of either team or an admin can complete this game.');
      }

      if (game.complete) {
        throw new Error(`Game ${gameId} is already complete.`);
      }

      const [updated] = await db
        .update(games)
        .set({ complete: true })
        .where(eq(games.id, gameId))
        .returning();
      return updated;
    },
  }),
}));
