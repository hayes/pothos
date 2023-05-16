import { execute, GraphQLScalarType } from 'graphql';
import { DateTimeResolver as ogDateTimeResolver } from 'graphql-scalars';
import gql from 'graphql-tag';
import SchemaBuilder from '../src';

// Add generic types while waiting for https://github.com/Urigo/graphql-scalars/pull/1920
const DateTimeResolver = ogDateTimeResolver as GraphQLScalarType<Date, Date>;

const PositiveIntResolver = new GraphQLScalarType({
  name: 'PositiveInt',
  serialize: (n) => n as number,
  parseValue: (n) => {
    if (typeof n !== 'number') {
      throw new TypeError('Value must be a number');
    }

    if (n >= 0) {
      return n;
    }

    throw new TypeError('Value must be positive');
  },
});

describe('scalars', () => {
  it('when a scalar is added withScalars, the scalartype is added', () => {
    const builder = new SchemaBuilder({}).withScalars({ PositiveInt: PositiveIntResolver });
    builder.queryType();
    builder.queryFields((t) => ({
      positiveInt: t.field({
        type: 'PositiveInt',
        args: { v: t.arg.int({ required: true }) },
        resolve: (_root, args) => args.v,
      }),
    }));

    const schema = builder.toSchema();
    expect(() =>
      execute({
        schema,
        document: gql`query { positiveInt("hello") }`,
      }),
    ).toThrow('Expected Name, found String "hello"');
  });

  it('when scalars are added using withScalars, the Objects from the user schema are kept', async () => {
    const builder = new SchemaBuilder<{
      Objects: {
        Example: { n: number };
      };
    }>({}).withScalars({
      PositiveInt: PositiveIntResolver,
    });

    const Example = builder.objectType('Example', {
      fields: (t) => ({
        n: t.expose('n', {
          type: 'PositiveInt',
        }),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        example: t.field({
          type: Example,
          resolve: () => ({ n: 1 }),
        }),
      }),
    });
    const schema = builder.toSchema();

    const result = await execute({
      schema,
      document: gql`
        query {
          example {
            n
          }
        }
      `,
    });
    expect(result.data).toEqual({ example: { n: 1 } });
  });

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
