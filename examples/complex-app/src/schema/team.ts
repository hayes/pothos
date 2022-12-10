import { builder } from '../builder';
import { db } from '../db';
import { parseID } from '../utils';
import { CreatePlayerInput } from './player';

builder.prismaNode('Team', {
  findUnique: (id) => ({ id: parseID(id) }),
  id: {
    resolve: ({ id }) => id,
  },
  fields: (t) => ({
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    name: t.exposeString('name'),
    players: t.relation('players'),
    playersConnection: t.relatedConnection('players', {
      cursor: 'id',
      totalCount: true,
    }),
    points: t.relatedConnection('points', {
      cursor: 'id',
      query: {
        orderBy: { createdAt: 'desc' },
      },
    }),
    games: t.relatedConnection('games', {
      cursor: 'id',
      query: {
        orderBy: { createdAt: 'desc' },
      },
    }),
  }),
});

builder.queryFields((t) => ({
  teams: t.prismaConnection({
    type: 'Team',
    cursor: 'id',
    totalCount: () => db.team.count(),
    resolve: (query) => db.team.findMany({ ...query, orderBy: { createdAt: 'desc' } }),
  }),
  team: t.prismaField({
    type: 'Team',
    args: { id: t.arg.id({ required: true }) },
    nullable: true,
    resolve: (query, _, { id }) =>
      db.team.findUnique({
        ...query,
        where: {
          id: parseID(id),
        },
      }),
  }),
}));

const CreateTeamInput = builder.inputType('CreateTeamInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    players: t.field({ type: [CreatePlayerInput] }),
  }),
});

builder.mutationField('createTeam', (t) =>
  t.prismaField({
    type: 'Team',
    nullable: true,
    args: {
      input: t.arg({ type: CreateTeamInput, required: true }),
    },
    resolve: (query, _, { input }) =>
      db.team.create({
        ...query,
        data: {
          name: input.name,
          players: {
            create: input.players
              ? input.players.map((player) => ({
                  name: player.name,
                  number: player.number,
                }))
              : [],
          },
        },
      }),
  }),
);
