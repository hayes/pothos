import SchemaBuilder, { type ArgBuilder } from '@pothos/core';

interface ITeam {
  id: string;
  name: string;
  city: string;
}

interface IPlayer {
  id: string;
  name: string;
  teamId: string;
}

const Teams: ITeam[] = [
  { id: 'comet', name: 'Comet', city: 'Riverside' },
  { id: 'vortex', name: 'Vortex', city: 'Lakeside' },
  { id: 'mist', name: 'Mist', city: 'Harborview' },
];

const Players: IPlayer[] = [
  { id: 'p1', name: 'Alex Rivers', teamId: 'comet' },
  { id: 'p2', name: 'Jordan Lake', teamId: 'vortex' },
  { id: 'p3', name: 'Sam Harbor', teamId: 'mist' },
];

function listTeams({ limit, offset }: { limit: number; offset: number }) {
  return Teams.slice(offset, offset + limit);
}

function listPlayers({
  limit,
  offset,
  teamId,
}: {
  limit: number;
  offset: number;
  teamId?: string | null;
}) {
  const filtered = teamId ? Players.filter((player) => player.teamId === teamId) : Players;
  return filtered.slice(offset, offset + limit);
}

export interface SchemaTypes {
  Scalars: {
    ID: {
      Input: string;
      Output: string;
    };
  };
}

export type TypesWithDefaults = PothosSchemaTypes.ExtendDefaultTypes<SchemaTypes>;

const builder = new SchemaBuilder<SchemaTypes>({});

const Team = builder.objectRef<ITeam>('Team').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    city: t.exposeString('city'),
  }),
});

const Player = builder.objectRef<IPlayer>('Player').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    teamId: t.exposeID('teamId'),
  }),
});

// queryType with no fields just declares the Query root so queryFields
// below has somewhere to attach.
builder.queryType({});

// Arguments are inferred from the literal `args:` object Pothos sees,
// so this helper takes the field builder's `arg` property and returns
// the args map to spread into each field.
// #region pagination-args
function pagination(t: { arg: ArgBuilder<TypesWithDefaults> }) {
  return {
    limit: t.arg.int({ required: true, defaultValue: 25 }),
    offset: t.arg.int({ required: true, defaultValue: 0 }),
  };
}

builder.queryFields((t) => ({
  teams: t.field({
    type: [Team],
    args: { ...pagination(t) },
    resolve: (_root, args) => listTeams(args),
  }),
  players: t.field({
    type: [Player],
    args: { ...pagination(t), teamId: t.arg.id() },
    resolve: (_root, args) => listPlayers(args),
  }),
}));
// #endregion pagination-args

export const schema = builder.toSchema();
