import { GraphQLScalarType } from 'graphql';
import {
  DateTimeResolver as ogDateTimeResolver,
  PositiveIntResolver as ogPositiveIntResolver,
} from 'graphql-scalars';
import SchemaBuilder from '../src';

// Add generic types while waiting for https://github.com/Urigo/graphql-scalars/pull/1920
const DateTimeResolver = ogDateTimeResolver as GraphQLScalarType<Date, Date>;
const PositiveIntResolver = ogPositiveIntResolver as GraphQLScalarType<number, number>;

describe('scalars', () => {
  it.todo('when a scalar is added withScalars, the scalartype is added');
  it.todo('when scalars are added using withScalars, the Scalars from the user schema are kept');
  it.todo('when scalars are added using withScalars, the Objects from the user schema are kept');
  it.todo('when scalars are added using withScalars, the Interfaces from the user schema are kept');
  it.todo('when scalars are added using withScalars, the Context from the user schema are kept');
  it.todo(
    'when scalars are added using withScalars, the DefaultFieldNullability from the user schema are kept',
  );
  it.todo(
    'when scalars are added using withScalars, the DefaultInputFieldRequiredness from the user schema are kept',
  );

  it('when scalars are added withScalars, scalars can still be manually typed', () => {
    const builder = new SchemaBuilder<{
      Scalars: {
        PositiveInt: { Input: number; Output: number };
      };
    }>({}).withScalars({ DateTime: DateTimeResolver });

    builder.addScalarType('PositiveInt', PositiveIntResolver, {});

    builder.objectRef<{}>('Example').implement({
      fields: (t) => ({
        // Manual typing
        positiveInt: t.field({
          type: 'PositiveInt',
          resolve: () => 1,
        }),
        // Inferred
        datetime: t.field({
          type: 'DateTime',
          resolve: () => new Date(),
        }),
      }),
    });

    expect(builder).toBeDefined();
  });

  it('when the scalar has internal types the, scalar types are infered are possible', () => {
    const builder = new SchemaBuilder({}).withScalars({
      DateTime: DateTimeResolver,
      PositiveInt: PositiveIntResolver,
    });

    builder.objectRef<{}>('Example').implement({
      fields: (t) => ({
        positiveInt: t.field({
          type: 'PositiveInt',
          resolve: () => 1,
        }),
        datetime: t.field({
          type: 'DateTime',
          resolve: () => new Date(),
        }),
      }),
    });

    expect(builder).toBeDefined();
  });
});
