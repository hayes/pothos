import SchemaBuilder from '@pothos/core';
import MocksPlugin from '@pothos/plugin-mocks';

const builder = new SchemaBuilder({
  plugins: [MocksPlugin],
});

interface ITeam {
  id: number;
  name: string;
  wins: number;
}

// #region types
const Team = builder.objectRef<ITeam>('Team').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    wins: t.exposeInt('wins'),
    // The recent-form feed isn't built yet, so the real resolver throws.
    form: t.string({
      resolve: () => {
        throw new Error('form not implemented');
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    // The live standings feed isn't wired up yet — the resolver throws until it is.
    standings: t.field({
      type: [Team],
      resolve: () => {
        throw new Error('standings feed not implemented');
      },
    }),
  }),
});
// #endregion types

// Mocks are keyed by type name, then field name. Unmocked fields keep their
// real resolver; here every mocked field's resolver throws, so the query only
// works because the mocks stand in for it.
// #region mock-schema
export const schema = builder.toSchema({
  mocks: {
    Query: {
      standings: () => [
        { id: 1, name: 'Comet', wins: 9 },
        { id: 2, name: 'Aurora', wins: 7 },
        { id: 3, name: 'Vertex', wins: 6 },
      ],
    },
    Team: {
      form: () => 'WWLWD',
    },
  },
});
// #endregion mock-schema
