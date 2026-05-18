import SchemaBuilder from '@pothos/core';

interface IGame {
  id: number;
  homeTeam: string;
  awayTeam: string;
  createdAt: Date;
}

const Games: IGame[] = [
  { id: 1, homeTeam: 'Comet', awayTeam: 'Vortex', createdAt: new Date('2026-04-12T18:00:00Z') },
  { id: 2, homeTeam: 'Mist', awayTeam: 'Halo', createdAt: new Date('2026-04-14T20:15:00Z') },
];

// Custom scalars are registered in the builder generic, then defined
// with builder.scalarType. The Input/Output split lets you accept and
// emit different shapes (e.g. parse a string into a Date).
const builder = new SchemaBuilder<{
  Scalars: {
    DateTime: { Input: Date; Output: Date };
  };
}>({});

builder.scalarType('DateTime', {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => {
    if (typeof value !== 'string') {
      throw new Error('DateTime must be an ISO 8601 string');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid DateTime');
    }
    return date;
  },
});

const Game = builder.objectRef<IGame>('Game').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    homeTeam: t.exposeString('homeTeam'),
    awayTeam: t.exposeString('awayTeam'),
    createdAt: t.field({ type: 'DateTime', resolve: (g) => g.createdAt }),
  }),
});

builder.queryType({
  fields: (t) => ({
    upcomingGames: t.field({
      type: [Game],
      args: { after: t.arg({ type: 'DateTime' }) },
      resolve: (_root, { after }) =>
        Games.filter((g) => !after || g.createdAt >= after),
    }),
  }),
});

export const schema = builder.toSchema();
