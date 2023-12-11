import { execute } from 'graphql';
import gql from 'graphql-tag';
import { SchemaTypes } from '../src';
import SchemaBuilder from '../src/builder';

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

  /**
   * Each enumType should act the same way
   */
  it.each([
    [
      'Typescript numeric enum uses keys',
      (builder: SchemaBuilder<SchemaTypes>) =>
        builder.enumType(ChessPieceNumeric, { name: 'ChessPiece' }),
    ],
    [
      'Typescript string enum uses keys',
      (builder: SchemaBuilder<SchemaTypes>) =>
        builder.enumType(ChessPieceString, { name: 'ChessPiece' }),
    ],
    [
      'Array of strings uses values',
      (builder: SchemaBuilder<SchemaTypes>) =>
        builder.enumType('ChessPiece', {
          values: ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'] as const,
        }),
    ],
    [
      'Object values uses keys',
      (builder: SchemaBuilder<SchemaTypes>) =>
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
    const builder = new SchemaBuilder({});
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

    expect(values.sort()).equal(['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'].sort());

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
    expect(result.data).equal({
      P: 'Pawn',
      N: 'Knight',
      B: 'Bishop',
      R: 'Rook',
      Q: 'Queen',
      K: 'King',
    });
  });
});
