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
    roster: t.field({
      type: [Player],
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
  }),
});

export const schema = builder.toSchema();
