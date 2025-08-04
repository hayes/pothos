import { z } from 'zod';
import { builder } from '../builder';
import { db } from '../db';
import { parseID } from '../utils';

builder.prismaNode('Player', {
  findUnique: (id) => ({ id: parseID(id) }),
  id: {
    resolve: ({ id }) => id,
  },
  fields: (t) => ({
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    name: t.exposeString('name'),
    team: t.relation('team'),
    points: t.relatedConnection('points', {
      cursor: 'id',
      query: {
        orderBy: { createdAt: 'desc' },
      },
    }),
    games: t.prismaConnection({
      type: 'Game',
      cursor: 'id',
      resolve: (query, player) =>
        db.game.findMany({
          ...query,
          orderBy: {
            createdAt: 'desc',
          },
          where: {
            team: { id: player.teamId },
            points: {
              some: {
                players: {
                  some: {
                    id: player.id,
                  },
                },
              },
            },
          },
        }),
    }),
  }),
});

export const CreatePlayerInput = builder.inputType('CreatePlayerInput', {
  validate: z.object({
    name: z.string().trim().nonempty(),
    number: z.number().int(),
  }),
  fields: (t) => ({
    name: t.string({ required: true }),
    number: t.int({ required: true }),
  }),
});

const AddPlayerToTeamInput = builder.inputType('AddPlayerToTeamInput', {
  fields: (t) => ({
    teamId: t.id({ required: true }),
    player: t.field({ type: CreatePlayerInput, required: true }),
  }),
});

builder.mutationField('addPlayerToTeam', (t) =>
  t.prismaField({
    type: 'Team',
    nullable: true,
    args: {
      input: t.arg({ type: AddPlayerToTeamInput, required: true }),
    },
    resolve: (query, _, { input }) =>
      db.team.update({
        ...query,
        where: { id: parseID(input.teamId) },
        data: {
          players: {
            create: {
              name: input.player.name,
              number: input.player.number,
            },
          },
        },
      }),
  }),
);

const AddPlayersToTeamInput = builder.inputType('AddPlayersToTeamInput', {
  fields: (t) => ({
    teamId: t.id({ required: true }),
    players: t.field({ type: [CreatePlayerInput], required: true }),
  }),
});

builder.mutationField('addPlayersToTeam', (t) =>
  t.prismaField({
    type: 'Team',
    nullable: true,
    args: {
      input: t.arg({ type: AddPlayersToTeamInput, required: true }),
    },
    resolve: (query, _, { input }) =>
      db.team.update({
        ...query,
        where: {
          id: parseID(input.teamId),
        },
        data: {
          players: {
            create: input.players.map((player) => ({
              name: player.name,
              number: player.number,
            })),
          },
        },
      }),
  }),
);
