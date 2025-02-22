import { builder } from '../builder';
import { db } from '../db';
import { parseID } from '../utils';

builder.prismaNode('Point', {
  findUnique: (id) => ({ id: parseID(id) }),
  id: {
    resolve: ({ id }) => id,
  },
  fields: (t) => ({
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    scored: t.exposeBoolean('scored'),
    startedOnOffense: t.exposeBoolean('startedOnOffense'),
    players: t.relation('players'),
    game: t.relation('game'),
    team: t.relation('team'),
  }),
});

export const AddPointInput = builder.inputType('CreatePointInput', {
  fields: (t) => ({
    gameId: t.id({ required: true }),
    scored: t.boolean({ required: true }),
    startedOnOffense: t.boolean({ required: true }),
    playerIds: t.idList({ required: true }),
  }),
});

builder.mutationField('addPoint', (t) =>
  t.prismaField({
    type: 'Point',
    nullable: true,
    args: {
      input: t.arg({ type: AddPointInput, required: true }),
    },
    resolve: async (query, _, { input }) => {
      const game = await db.game.findUniqueOrThrow({ where: { id: parseID(input.gameId) } });

      return db.point.create(
        query({
          data: {
            scored: input.scored,
            startedOnOffense: input.startedOnOffense,
            players: {
              connect: input.playerIds.map((id) => ({ id: parseID(id) })),
            },
            game: {
              connect: { id: game.id },
            },
            team: {
              connect: { id: game.teamId },
            },
          },
        }),
      );
    },
  }),
);
