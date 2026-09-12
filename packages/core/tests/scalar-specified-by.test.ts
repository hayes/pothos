import { GraphQLScalarType } from 'graphql';
import SchemaBuilder from '../src';

const specUrl = 'https://example.com/spec/date-time';

describe('scalar specifiedByURL', () => {
  it('preserves specifiedByURL from an imported scalar', () => {
    const imported = new GraphQLScalarType<Date, string>({
      name: 'DateTime',
      specifiedByURL: specUrl,
      serialize: (value) => (value as Date).toISOString(),
      parseValue: (value) => new Date(value as string),
    });

    const builder = new SchemaBuilder<{ Scalars: { DateTime: { Input: Date; Output: Date } } }>({});

    builder.addScalarType('DateTime', imported);
    builder.queryType({
      fields: (t) => ({
        now: t.field({ type: 'DateTime', resolve: () => new Date(0) }),
      }),
    });

    const schema = builder.toSchema();

    expect((schema.getType('DateTime') as GraphQLScalarType).specifiedByURL).toBe(specUrl);
  });

  it('supports specifiedByURL on scalarType options', () => {
    const builder = new SchemaBuilder<{ Scalars: { DateTime: { Input: Date; Output: Date } } }>({});

    builder.scalarType('DateTime', {
      specifiedByURL: specUrl,
      serialize: (value) => value.toISOString(),
      parseValue: (value) => new Date(value as string),
    });

    builder.queryType({
      fields: (t) => ({
        now: t.field({ type: 'DateTime', resolve: () => new Date(0) }),
      }),
    });

    const schema = builder.toSchema();

    expect((schema.getType('DateTime') as GraphQLScalarType).specifiedByURL).toBe(specUrl);
  });
});
