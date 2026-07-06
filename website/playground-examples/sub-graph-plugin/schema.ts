import SchemaBuilder from '@pothos/core';
import SubGraphPlugin from '@pothos/plugin-sub-graph';

// #region builder
const builder = new SchemaBuilder<{
  SubGraphs: 'Public' | 'Internal';
}>({
  plugins: [SubGraphPlugin],
  subGraphs: {
    // A type with no subGraphs of its own belongs to every sub-graph.
    defaultForTypes: ['Public', 'Internal'],
    // A field with no subGraphs inherits its parent type's membership.
    fieldsInheritFromTypes: true,
  },
});
// #endregion builder

interface ITeam {
  id: number;
  name: string;
  budget: number;
  roster: IPlayer[];
}

interface IPlayer {
  id: number;
  name: string;
  salary: number;
}

const Teams = new Map<number, ITeam>([
  [1, { id: 1, name: 'Comet', budget: 250_000, roster: [{ id: 1, name: 'Reyes', salary: 90_000 }] }],
  [2, { id: 2, name: 'Aurora', budget: 180_000, roster: [{ id: 2, name: 'Okafor', salary: 75_000 }] }],
]);

// #region types
// The whole Player type lives only in the Internal graph.
const Player = builder.objectRef<IPlayer>('Player').implement({
  subGraphs: ['Internal'],
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    salary: t.exposeInt('salary'),
  }),
});

const Team = builder.objectRef<ITeam>('Team').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    // A single field held back from the Public graph.
    budget: t.exposeInt('budget', { subGraphs: ['Internal'] }),
    // Returns an Internal-only type, so it can only live in Internal.
    roster: t.field({
      type: [Player],
      subGraphs: ['Internal'],
      resolve: (team) => team.roster,
    }),
  }),
});
// #endregion types

builder.queryType({
  fields: (t) => ({
    teams: t.field({
      type: [Team],
      resolve: () => [...Teams.values()],
    }),
  }),
});

// Build the Public view: budget, roster, and the Player type are all dropped.
// Swap 'Public' for 'Internal' to build the full internal graph instead.
export const schema = builder.toSchema({ subGraph: 'Public' });
