import SchemaBuilder from '@pothos/core';
import { lexicographicSortSchema, printSchema } from 'graphql';

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
  [2, { id: 2, name: 'Riptide' }],
]);

const Players = new Map<number, IPlayer>([
  [1, { id: 1, name: 'Alex Rivera', teamId: 1 }],
  [2, { id: 2, name: 'Sam Okafor', teamId: 2 }],
]);

const builder = new SchemaBuilder({});

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
      resolve: (team) => [...Players.values()].filter((player) => player.teamId === team.id),
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

// #region print-schema-export
export const schema = builder.toSchema();
// #endregion print-schema-export

// The playground sandbox has no filesystem, but `printSchema` and
// `lexicographicSortSchema` are the same two calls the "Printing to a
// file" doc wires into a package.json script — only the destination
// changes. Open the console panel to see the sorted SDL.
// #region print-schema-log
console.log(printSchema(lexicographicSortSchema(schema)));
// #endregion print-schema-log
