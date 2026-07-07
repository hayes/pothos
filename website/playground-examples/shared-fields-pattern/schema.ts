import SchemaBuilder from '@pothos/core';
import type { ObjectRef } from '@pothos/core';

interface ITeam {
  id: string;
  createdAt: Date;
  name: string;
  city: string;
}

interface IPlayer {
  id: string;
  createdAt: Date;
  name: string;
  teamId: string;
}

const Teams: ITeam[] = [
  { id: 'comet', createdAt: new Date('2020-03-01'), name: 'Comet', city: 'Riverside' },
  { id: 'vortex', createdAt: new Date('2021-06-15'), name: 'Vortex', city: 'Lakeside' },
];

const Players: IPlayer[] = [
  { id: 'p1', createdAt: new Date('2022-01-10'), name: 'Alex Rivers', teamId: 'comet' },
  { id: 'p2', createdAt: new Date('2022-02-20'), name: 'Jordan Lake', teamId: 'vortex' },
];

export interface SchemaTypes {
  Scalars: {
    DateTime: { Input: Date; Output: Date };
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

// `builder.objectFields` adds fields to a ref *after* it's created, so
// a helper can add the same fields to any ref whose backing model
// satisfies the constraint. Team and Player never redeclare `id` or
// `createdAt` themselves.
// #region add-audit-fields
function addAuditFields<
  Refs extends readonly ObjectRef<TypesWithDefaults, { id: string; createdAt: Date }>[],
>(refs: Refs) {
  for (const ref of refs) {
    builder.objectFields(ref, (t) => ({
      id: t.field({ type: 'ID', resolve: (parent) => parent.id }),
      createdAt: t.field({ type: 'DateTime', resolve: (parent) => parent.createdAt }),
    }));
  }
}

const Team = builder.objectRef<ITeam>('Team').implement({
  fields: (t) => ({
    name: t.exposeString('name'),
  }),
});

const Player = builder.objectRef<IPlayer>('Player').implement({
  fields: (t) => ({
    name: t.exposeString('name'),
  }),
});

addAuditFields([Team, Player]);
// #endregion add-audit-fields

builder.queryType({
  fields: (t) => ({
    teams: t.field({ type: [Team], resolve: () => Teams }),
    players: t.field({ type: [Player], resolve: () => Players }),
  }),
});

export const schema = builder.toSchema();
