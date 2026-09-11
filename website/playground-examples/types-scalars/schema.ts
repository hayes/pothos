// #region schema
import SchemaBuilder from '@pothos/core';
import { GraphQLError, Kind } from 'graphql';

const builder = new SchemaBuilder<{
  Scalars: {
    PositiveInt: { Input: number; Output: number };
  };
}>({});

function positiveInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new GraphQLError('PositiveInt must be a positive safe integer');
  }

  return value;
}

builder.scalarType('PositiveInt', {
  serialize: positiveInt,
  parseValue: positiveInt,
  parseLiteral: (node) => {
    if (node.kind !== Kind.INT) {
      throw new GraphQLError('PositiveInt must be an integer literal');
    }

    return positiveInt(Number(node.value));
  },
});

builder.queryType({
  fields: (t) => ({
    double: t.field({
      type: 'PositiveInt',
      args: { value: t.arg({ type: 'PositiveInt', required: true }) },
      resolve: (_parent, { value }) => value * 2,
    }),
  }),
});

export const schema = builder.toSchema();
// #endregion schema
