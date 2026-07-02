import SchemaBuilder from '@pothos/core';
import ComplexityPlugin from '@pothos/plugin-complexity';

const builder = new SchemaBuilder({
  plugins: [ComplexityPlugin],
  complexity: {
    defaultComplexity: 1,
    defaultListMultiplier: 10,
    limit: {
      complexity: 100,
      depth: 5,
      breadth: 30,
    },
  },
});

interface ITeam {
  id: number;
  name: string;
}

interface IPlayer {
  id: number;
  name: string;
  teamId: number;
}

const Teams = new Map<number, ITeam>([
  [1, { id: 1, name: 'Comet' }],
  [2, { id: 2, name: 'Aurora' }],
  [3, { id: 3, name: 'Vertex' }],
]);

const Players = new Map<number, IPlayer>([
  [1, { id: 1, name: 'Ada', teamId: 1 }],
  [2, { id: 2, name: 'Bex', teamId: 1 }],
  [3, { id: 3, name: 'Cy', teamId: 2 }],
  [4, { id: 4, name: 'Dez', teamId: 3 }],
]);

const Player = builder.objectRef<IPlayer>('Player').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

const Team = builder.objectRef<ITeam>('Team').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    // A roster is cheap to load once the team is in memory: override both the
    // field cost and the default list multiplier of 10 with hand-tuned values.
    roster: t.field({
      type: [Player],
      complexity: { field: 2, multiplier: 5 },
      resolve: (team) => [...Players.values()].filter((p) => p.teamId === team.id),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    teams: t.field({
      type: [Team],
      resolve: () => [...Teams.values()],
    }),
    // A flat base cost for an expensive aggregate; its list sub-selections
    // still use the default multiplier of 10.
    leaderboard: t.field({
      type: [Player],
      complexity: 20,
      resolve: () => [...Players.values()],
    }),
    // Cost scales with how many rows the caller asks for.
    players: t.field({
      type: [Player],
      args: {
        first: t.arg.int(),
      },
      complexity: (args) => ({ field: 5, multiplier: args.first ?? 5 }),
      resolve: (_parent, { first }) => [...Players.values()].slice(0, first ?? undefined),
    }),
  }),
});

export const schema = builder.toSchema();
