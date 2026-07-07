import SchemaBuilder, { type InputFieldBuilder } from '@pothos/core';

interface IGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  createdAt: Date;
}

interface IPlayer {
  id: string;
  name: string;
  teamId: string;
  position: string;
}

const Games: IGame[] = [
  { id: 'g1', homeTeam: 'Comet', awayTeam: 'Vortex', createdAt: new Date('2026-04-12T18:00:00Z') },
  { id: 'g2', homeTeam: 'Mist', awayTeam: 'Halo', createdAt: new Date('2026-04-14T20:15:00Z') },
];

const Players: IPlayer[] = [
  { id: 'p1', name: 'Alex Rivers', teamId: 'comet', position: 'Handler' },
  { id: 'p2', name: 'Jordan Lake', teamId: 'vortex', position: 'Cutter' },
];

interface GameFilterShape {
  createdAfter?: Date | null;
  createdBefore?: Date | null;
  teamId?: string | null;
}

interface PlayerFilterShape {
  createdAfter?: Date | null;
  createdBefore?: Date | null;
  position?: string | null;
}

export interface SchemaTypes {
  Scalars: {
    ID: { Input: string; Output: string };
    DateTime: { Input: Date; Output: Date };
  };
  InputObjects: {
    GameFilter: GameFilterShape;
    PlayerFilter: PlayerFilterShape;
  };
}

export type TypesWithDefaults = PothosSchemaTypes.ExtendDefaultTypes<SchemaTypes>;

const builder = new SchemaBuilder<SchemaTypes>({});

builder.scalarType('DateTime', {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => {
    if (typeof value !== 'string') {
      throw new Error('DateTime must be an ISO 8601 string');
    }
    return new Date(value);
  },
});

// Input fields work the same way as object fields: write a helper that
// returns the shared fields map and spread it into each input type.
function timestampInputs(t: InputFieldBuilder<TypesWithDefaults, 'InputObject'>) {
  return {
    createdAfter: t.field({ type: 'DateTime', required: false }),
    createdBefore: t.field({ type: 'DateTime', required: false }),
  };
}

const GameFilter = builder.inputType('GameFilter', {
  fields: (t) => ({
    ...timestampInputs(t),
    teamId: t.id(),
  }),
});

const PlayerFilter = builder.inputType('PlayerFilter', {
  fields: (t) => ({
    ...timestampInputs(t),
    position: t.string(),
  }),
});

const Game = builder.objectRef<IGame>('Game').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    homeTeam: t.exposeString('homeTeam'),
    awayTeam: t.exposeString('awayTeam'),
    createdAt: t.field({ type: 'DateTime', resolve: (g) => g.createdAt }),
  }),
});

const Player = builder.objectRef<IPlayer>('Player').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    teamId: t.exposeID('teamId'),
    position: t.exposeString('position'),
  }),
});

builder.queryType({
  fields: (t) => ({
    games: t.field({
      type: [Game],
      args: { filter: t.arg({ type: GameFilter }) },
      resolve: (_root, { filter }) =>
        Games.filter((game) => {
          if (filter?.createdAfter && game.createdAt < filter.createdAfter) {
            return false;
          }
          if (filter?.createdBefore && game.createdAt > filter.createdBefore) {
            return false;
          }
          if (
            filter?.teamId &&
            game.homeTeam !== filter.teamId &&
            game.awayTeam !== filter.teamId
          ) {
            return false;
          }
          return true;
        }),
    }),
    players: t.field({
      type: [Player],
      args: { filter: t.arg({ type: PlayerFilter }) },
      resolve: (_root, { filter }) =>
        Players.filter((player) => {
          if (filter?.position && player.position !== filter.position) {
            return false;
          }
          return true;
        }),
    }),
  }),
});

export const schema = builder.toSchema();
