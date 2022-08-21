import { builder } from '../builder';
import { db } from '../db';
import { parseID } from '../utils';

builder.prismaNode('Game', {
  findUnique: (id) => ({ id: parseID(id) }),
  id: {
    resolve: ({ id }) => id,
  },
  fields: (t) => ({
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    complete: t.exposeBoolean('complete'),
    opponentName: t.exposeString('opponentName'),
    points: t.relation('points', {
      query: {
        orderBy: { createdAt: 'asc' },
      },
    }),
    team: t.relation('team'),
    score: t.field({
      select: {
        points: {
          // match order of points so selection can be reused
          orderBy: { createdAt: 'asc' },
        },
      },
      type: GameScore,
      resolve: ({ points }) => {
        let ownScore = 0;
        let opponentScore = 0;

        for (const point of points) {
          if (point.scored) {
            ownScore += 1;
          } else {
            opponentScore += 1;
          }
        }

        return { ownScore, opponentScore };
      },
    }),
  }),
});

const GameScore = builder.simpleObject('GameScore', {
  fields: (t) => ({
    ownScore: t.int(),
    opponentScore: t.int(),
  }),
});

builder.queryFields((t) => ({
  games: t.prismaConnection({
    type: 'Game',
    cursor: 'id',
    resolve: (query) => db.game.findMany({ ...query, orderBy: { createdAt: 'desc' } }),
  }),
  game: t.prismaField({
    type: 'Game',
    args: { id: t.arg.id({ required: true }) },
    nullable: true,
    resolve: (query, _, { id }) =>
      db.game.findUnique({
        ...query,
        where: {
          id: parseID(id),
        },
      }),
  }),
}));

const CreateGame = builder.inputType('CreateGame', {
  fields: (t) => ({
    teamId: t.id({ required: true }),
    complete: t.boolean(),
    opponentName: t.string({ required: true }),
  }),
});

builder.mutationField('createGame', (t) =>
  t.prismaField({
    type: 'Game',
    args: {
      input: t.arg({ type: CreateGame, required: true }),
    },
    resolve: async (query, _, { input }) => {
      const game = await db.game.create({
        data: {
          complete: input.complete ?? false,
          opponentName: input.opponentName,
          team: {
            connect: {
              id: parseID(input.teamId),
            },
          },
        },
      });

      return game;
    },
  }),
);
