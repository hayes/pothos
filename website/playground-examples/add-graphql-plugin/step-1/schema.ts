import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import {
  GraphQLEnumType,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';

interface ITeam {
  id: string;
  name: string;
  wins: number;
  division: 'EAST' | 'WEST';
}

const Teams = new Map<string, ITeam>([
  ['1', { id: '1', name: 'Comet', wins: 11, division: 'EAST' }],
  ['2', { id: '2', name: 'Aurora', wins: 8, division: 'WEST' }],
  ['3', { id: '3', name: 'Vertex', wins: 9, division: 'EAST' }],
]);

// The legacy service we're migrating from: hand-written graphql-js types.
const LegacyDivision = new GraphQLEnumType({
  name: 'Division',
  values: { EAST: {}, WEST: {} },
});

const LegacyTeam = new GraphQLObjectType<ITeam>({
  name: 'Team',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    name: { type: new GraphQLNonNull(GraphQLString) },
    wins: { type: new GraphQLNonNull(GraphQLInt) },
    // Division is reachable through this field, so it's imported too.
    division: { type: new GraphQLNonNull(LegacyDivision) },
  }),
});

// #region schema-import
const legacySchema = new GraphQLSchema({ types: [LegacyTeam] });

// Registering Team on the Objects generic lets you reference it by name.
const builder = new SchemaBuilder<{
  Objects: { Team: ITeam };
}>({
  plugins: [AddGraphQLPlugin],
  add: {
    // Import every type in the schema; dependencies come along recursively.
    schema: legacySchema,
  },
});

builder.queryType({
  fields: (t) => ({
    teams: t.field({
      type: ['Team'],
      resolve: () => [...Teams.values()],
    }),
  }),
});
// #endregion schema-import

export const schema = builder.toSchema();
