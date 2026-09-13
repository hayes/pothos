import { execute } from 'graphql';
import gql from 'graphql-tag';
import { expectTypeOf } from 'vitest';
import SchemaBuilder from '../src';

type Types = { Scalars: { Timestamp: { Input: number; Output: Date } } };

function asymmetricScalarSchema() {
  const builder = new SchemaBuilder<Types>({});

  const timestamp = builder.scalarType('Timestamp', {
    serialize: (value) => value.toISOString(),
    parseValue: (value) => Number(value),
  });

  expectTypeOf(timestamp.$inferType).toEqualTypeOf<Date>();
  expectTypeOf(timestamp.$inferInput).toEqualTypeOf<number>();

  builder.queryType({
    fields: (t) => ({
      nameOutput: t.field({
        type: 'Timestamp',
        resolve: () => new Date(0),
      }),
      nameInput: t.string({
        args: { at: t.arg({ type: 'Timestamp', required: true }) },
        resolve: (_parent, args) => {
          expectTypeOf(args.at).toEqualTypeOf<number>();

          return args.at.toFixed(0);
        },
      }),
      refOutput: t.field({
        type: timestamp,
        resolve: () => new Date(0),
      }),
      refInput: t.string({
        args: { at: t.arg({ type: timestamp, required: true }) },
        resolve: (_parent, args) => {
          expectTypeOf(args.at).toEqualTypeOf<number>();

          return args.at.toFixed(0);
        },
      }),
    }),
  });

  return builder.toSchema();
}

function swappedShapeSchema() {
  const builder = new SchemaBuilder<Types>({});
  const timestamp = builder.scalarType('Timestamp', {
    serialize: (value) => value.toISOString(),
    parseValue: (value) => Number(value),
  });

  builder.queryType({
    fields: (t) => ({
      nameOutput: t.field({
        type: 'Timestamp',
        // @ts-expect-error a Timestamp resolver must return the Output shape (Date), not a number
        resolve: () => 0,
      }),
      refOutput: t.field({
        type: timestamp,
        // @ts-expect-error same for the ref
        resolve: () => 0,
      }),
      nameInput: t.string({
        args: { at: t.arg({ type: 'Timestamp', required: true }) },
        // @ts-expect-error a Timestamp argument is the Input shape (number), so it has no toISOString
        resolve: (_parent, args) => args.at.toISOString(),
      }),
      refInput: t.string({
        args: { at: t.arg({ type: timestamp, required: true }) },
        // @ts-expect-error same for the ref
        resolve: (_parent, args) => args.at.toISOString(),
      }),
    }),
  });

  return builder.toSchema();
}

describe('scalar refs', () => {
  it('infers the same input and output types as the scalar name', async () => {
    const result = await execute({
      schema: asymmetricScalarSchema(),
      document: gql`
        query {
          nameOutput
          nameInput(at: 0)
          refOutput
          refInput(at: 0)
        }
      `,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      nameOutput: '1970-01-01T00:00:00.000Z',
      nameInput: '0',
      refOutput: '1970-01-01T00:00:00.000Z',
      refInput: '0',
    });
  });

  it('rejects swapped shapes on both the name and the ref path', () => {
    expect(swappedShapeSchema().getType('Timestamp')).toBeDefined();
  });
});
