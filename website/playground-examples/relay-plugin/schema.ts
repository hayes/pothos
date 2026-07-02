import SchemaBuilder from '@pothos/core';
import RelayPlugin, { resolveArrayConnection } from '@pothos/plugin-relay';

const builder = new SchemaBuilder({
  plugins: [RelayPlugin],
  relay: {},
});

interface ITeam {
  id: string;
  name: string;
  city: string;
}

interface IPlayer {
  id: string;
  name: string;
  teamId: string;
}

const Teams = new Map<string, ITeam>([
  ['1', { id: '1', name: 'Comet', city: 'Seattle' }],
  ['2', { id: '2', name: 'Riptide', city: 'San Diego' }],
]);

const Players = new Map<string, IPlayer>([
  ['1', { id: '1', name: 'Ana Cruz', teamId: '1' }],
  ['2', { id: '2', name: 'Ben Ito', teamId: '1' }],
  ['3', { id: '3', name: 'Cara Lee', teamId: '2' }],
  ['4', { id: '4', name: 'Dan Ortiz', teamId: '2' }],
]);

const Team = builder.objectRef<ITeam>('Team');
const Player = builder.objectRef<IPlayer>('Player');

// A node is any object reachable by a single global ID.
builder.node(Team, {
  id: {
    resolve: (team) => team.id,
  },
  // loadOne / loadMany hydrate a node from the id decoded out of a global ID.
  loadOne: (id) => Teams.get(id) ?? null,
  loadMany: (ids) => ids.map((id) => Teams.get(id) ?? null),
  fields: (t) => ({
    name: t.exposeString('name'),
    city: t.exposeString('city'),
    // A connection paginates a list under one field.
    players: t.connection({
      type: Player,
      resolve: (team, args) =>
        resolveArrayConnection(
          { args },
          [...Players.values()].filter((player) => player.teamId === team.id),
        ),
    }),
  }),
});

builder.node(Player, {
  id: {
    resolve: (player) => player.id,
  },
  loadOne: (id) => Players.get(id) ?? null,
  loadMany: (ids) => ids.map((id) => Players.get(id) ?? null),
  fields: (t) => ({
    name: t.exposeString('name'),
    team: t.field({
      type: Team,
      resolve: (player) => Teams.get(player.teamId) ?? null,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    team: t.field({
      type: Team,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_parent, { id }) => Teams.get(String(id)) ?? null,
    }),
    players: t.connection({
      type: Player,
      resolve: (_parent, args) => resolveArrayConnection({ args }, [...Players.values()]),
    }),
  }),
});

export const schema = builder.toSchema();
