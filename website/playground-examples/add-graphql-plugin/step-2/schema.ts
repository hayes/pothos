import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import {
  GraphQLEnumType,
  GraphQLID,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';

interface IPlayer {
  id: string;
  fullName: string;
  position: 'HANDLER' | 'CUTTER';
}

const Players = new Map<string, IPlayer>([
  ['1', { id: '1', fullName: 'Robin Vega', position: 'HANDLER' }],
  ['2', { id: '2', fullName: 'Sam Okafor', position: 'CUTTER' }],
  ['3', { id: '3', fullName: 'Alex Rivera', position: 'HANDLER' }],
]);

// Types from the legacy graphql-js service.
const LegacyPosition = new GraphQLEnumType({
  name: 'Position',
  values: { HANDLER: {}, CUTTER: {} },
});

const LegacyPlayer = new GraphQLObjectType<IPlayer>({
  name: 'Player',
  fields: () => ({
    id: { type: new GraphQLNonNull(GraphQLID) },
    fullName: { type: new GraphQLNonNull(GraphQLString) },
    position: { type: new GraphQLNonNull(LegacyPosition) },
  }),
});

const LegacyPlayerFilter = new GraphQLInputObjectType({
  name: 'PlayerFilter',
  fields: () => ({
    position: { type: LegacyPosition },
  }),
});

const builder = new SchemaBuilder({
  plugins: [AddGraphQLPlugin],
});

// #region refs
// addGraphQLInput returns an InputObjectRef you can hang on any arg.
const PlayerFilter = builder.addGraphQLInput<{ position?: 'HANDLER' | 'CUTTER' }>(LegacyPlayerFilter);

// addGraphQLObject returns an ObjectRef. Customize fields as you import:
// null drops a field, and new entries are merged in alongside the rest.
const Player = builder.addGraphQLObject<IPlayer>(LegacyPlayer, {
  fields: (t) => ({
    fullName: null,
    displayName: t.exposeString('fullName'),
  }),
});

builder.queryType({
  fields: (t) => ({
    players: t.field({
      type: [Player],
      args: {
        filter: t.arg({ type: PlayerFilter }),
      },
      resolve: (_parent, { filter }) =>
        [...Players.values()].filter(
          (player) => !filter?.position || player.position === filter.position,
        ),
    }),
  }),
});
// #endregion refs

export const schema = builder.toSchema();
