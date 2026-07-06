import SchemaBuilder from '@pothos/core';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';

const builder = new SchemaBuilder({
  plugins: [SimpleObjectsPlugin],
});

// A simple object infers its backing model from the fields you declare.
// #region team-stats
const TeamStats = builder.simpleObject('TeamStats', {
  fields: (t) => ({
    wins: t.int({ nullable: false }),
    losses: t.int({ nullable: false }),
    pointDiff: t.int({ nullable: true }),
  }),
});
// #endregion team-stats

// A simple interface needs no separate backing type either.
// #region node
const Node = builder.simpleInterface('Node', {
  fields: (t) => ({
    id: t.id({ nullable: false }),
  }),
});
// #endregion node

// A simple object that implements an interface and adds a computed field.
// #region standing
const Standing = builder.simpleObject(
  'Standing',
  {
    interfaces: [Node],
    fields: (t) => ({
      team: t.string(),
      stats: t.field({ type: TeamStats, nullable: false }),
    }),
  },
  // Third argument: fields backed by resolvers, with the full inferred parent.
  (t) => ({
    record: t.string({
      resolve: (standing) => `${standing.stats.wins}-${standing.stats.losses}`,
    }),
  }),
);
// #endregion standing

builder.queryType({
  fields: (t) => ({
    standing: t.field({
      type: Standing,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: () => ({
        id: 'comet',
        team: 'Comet',
        stats: {
          wins: 11,
          losses: 3,
          pointDiff: 84,
        },
      }),
    }),
  }),
});

export const schema = builder.toSchema();
