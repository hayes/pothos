import SchemaBuilder from '@pothos/core';
import { DateResolver, JSONResolver } from 'graphql-scalars';

const builder = new SchemaBuilder<{
  Scalars: {
    JSON: { Input: unknown; Output: unknown };
    Date: { Input: Date; Output: Date };
  };
}>({});

builder.addScalarType('JSON', JSONResolver);
builder.addScalarType('Date', DateResolver);

builder.queryType({
  fields: (t) => ({
    date: t.field({ type: 'Date', resolve: () => new Date('2026-01-01T00:00:00Z') }),
    json: t.field({
      type: 'JSON',
      args: { value: t.arg({ type: 'JSON', required: true }) },
      resolve: (_parent, { value }) => value,
    }),
  }),
});

export const schema = builder.toSchema();
