import { execute } from 'graphql';
import gql from 'graphql-tag';
import SchemaBuilder, { SchemaTypes } from '../src';

describe('ways to add enums', () => {
  enum ChessPieceNumeric {
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen,
    King,
  }

  enum ChessPieceString {
    Pawn = 'P',
    Knight = 'N',
    Bishop = 'B',
    Rook = 'R',
    Queen = 'Q',
    King = 'K',
  }

  const ChessPieceObject = {
    Pawn: 'P',
    Knight: 'N',
    Bishop: 'B',
    Rook: 'R',
    Queen: 'Q',
    King: 'K',
  } as const;

  /**
   * Each enumType should act the same way
   */
  it.each([
    [
      'Typescript numeric enum uses keys',
      (builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>) =>
        builder.enumType(ChessPieceNumeric, { name: 'ChessPiece' }),
    ],
    [
      'Typescript string enum uses keys',
      (builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>) =>
        builder.enumType(ChessPieceString, { name: 'ChessPiece' }),
    ],
    [
      'Object entries',
      (builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>) => {
        const e = builder.enumType('ChessPiece', {
          values: Object.fromEntries(
            Object.entries(ChessPieceObject).map(([name, value]) => [name, { value }]),
          ),
        });

        return e;
      },
    ],
    [
      'Array of strings uses values',
      (builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>) =>
        builder.enumType('ChessPiece', {
          values: ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'] as const,
        }),
    ],
    [
      'Object values uses keys',
      (builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>) =>
        builder.enumType('ChessPiece', {
          values: {
            Pawn: { value: 'P' },
            Knight: { value: 'N' },
            Bishop: { value: 'B' },
            Rook: { value: 'R' },
            Queen: { value: 'Q' },
            King: { value: 'K' },
          } as const,
        }),
    ],
  ])('%s enum', async (_name, addEnum) => {
    const builder = new SchemaBuilder({}) as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
    const ChessPieceType = addEnum(builder);

    builder.queryType({
      fields: (t) => ({
        piece: t.field({
          type: ChessPieceType,
          args: { input: t.arg({ type: ChessPieceType }) },
          resolve: (_, args) => args.input,
        }),
      }),
    });

    const schema = builder.toSchema();
    const introspection = await execute({
      schema,
      document: gql`
        {
          __type(name: "ChessPiece") {
            enumValues {
              name
            }
          }
        }
      `,
    });
    // eslint-disable-next-line no-underscore-dangle
    const values = (introspection.data as any).__type.enumValues.map(
      (v: { name: string }) => v.name,
    );

    expect(values.sort()).toEqual(
      expect.arrayContaining(['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'].sort()),
    );

    const result = await execute({
      schema,
      document: gql`
        query {
          P: piece(input: Pawn)
          N: piece(input: Knight)
          B: piece(input: Bishop)
          R: piece(input: Rook)
          Q: piece(input: Queen)
          K: piece(input: King)
        }
      `,
    });
    expect(result.data).toMatchObject({
      P: 'Pawn',
      N: 'Knight',
      B: 'Bishop',
      R: 'Rook',
      Q: 'Queen',
      K: 'King',
    });
  });

  /** Validate docs for an object with `as const` (values) {@link website/pages/docs/guide/enums.mdx} */
  it('Object as const enum (entries)', async () => {
    const builder = new SchemaBuilder({});
    const VehicleType = {
      sedan: 'SEDAN',
      suv: 'SUV',
      truck: 'TRUCK',
      motorcycle: 'MOTORCYCLE',
    } as const;
    const VehicleTypeEnum = builder.enumType('VehicleType', {
      values: Object.fromEntries(
        Object.entries(VehicleType).map(([name, value]) => [name, { value }]),
      ),
    });
    builder.queryType({
      fields: (t) => ({
        vroom: t.field({
          type: VehicleTypeEnum,
          resolve: () => VehicleType.motorcycle,
        }),
      }),
    });
    const result = await execute({
      schema: builder.toSchema(),
      document: gql`
        query {
          vroom
        }
      `,
    });
    expect(result.data).toMatchObject({ vroom: 'motorcycle' });
  });

  /** Validate docs for an object with `as const` (values) {@link website/pages/docs/guide/enums.mdx} */
  it('Object as const enum (values)', async () => {
    const builder = new SchemaBuilder({});
    const VehicleType = {
      sedan: 'SEDAN',
      suv: 'SUV',
      truck: 'TRUCK',
      motorcycle: 'MOTORCYCLE',
    } as const;
    const VehicleTypeEnum = builder.enumType('VehicleType', {
      values: Object.values(VehicleType),
    });
    builder.queryType({
      fields: (t) => ({
        vroom: t.field({
          type: VehicleTypeEnum,
          resolve: () => VehicleType.motorcycle,
        }),
      }),
    });
    const result = await execute({
      schema: builder.toSchema(),
      document: gql`
        query {
          vroom
        }
      `,
    });
    expect(result.data).toMatchObject({ vroom: VehicleType.motorcycle });
  });

  /** Validate docs for an object with `as const` (keys) {@link website/pages/docs/guide/enums.mdx} */
  it('Object as const enum (keys)', async () => {
    const builder = new SchemaBuilder({});
    const VehicleType = {
      sedan: 'SEDAN',
      suv: 'SUV',
      truck: 'TRUCK',
      motorcycle: 'MOTORCYCLE',
    } as const;
    const VehicleTypeEnum = builder.enumType('VehicleType', {
      values: Object.keys(VehicleType) as (keyof typeof VehicleType)[],
    });
    builder.queryType({
      fields: (t) => ({
        vroom: t.field({
          type: VehicleTypeEnum,
          resolve: () => 'motorcycle' as const,
        }),
      }),
    });
    const result = await execute({
      schema: builder.toSchema(),
      document: gql`
        query {
          vroom
        }
      `,
    });
    expect(result.data).toMatchObject({ vroom: 'motorcycle' });
  });
});
