import { describe, expect, it } from 'vitest';
import {
  formatPrismaCursor,
  getDefaultIDParser,
  getDefaultIDSerializer,
  parseCompositeCursor,
  parsePrismaCursor,
} from '../src/util/cursors';
import type { DMMF, DMMFField } from '../src/util/get-client';

// The fixture schema has no float column, and every id it declares is an Int or a String, so the
// scalar types below can only be exercised against a datamodel written here. `getModel` reads
// `prisma.dmmf` when the builder carries one, which is all these helpers need.
function builderFor(
  fields: Partial<DMMFField>[],
  primaryKey: DMMF['datamodel']['models'][number]['primaryKey'] = null,
) {
  const dmmf = {
    datamodel: {
      models: [
        {
          name: 'Model',
          fields: fields.map((field) => ({
            kind: 'scalar',
            isRequired: true,
            isList: false,
            hasDefaultValue: false,
            isUnique: false,
            isId: false,
            ...field,
          })) as DMMFField[],
          primaryKey,
          uniqueIndexes: [],
        },
      ],
    },
  };

  return { options: { prisma: { dmmf } } } as unknown as PothosSchemaTypes.SchemaBuilder<never>;
}

describe('cursors', () => {
  it('round trips a value from a float column', () => {
    expect(parsePrismaCursor(formatPrismaCursor({ views: 1.75 }, 'views'))).toBe(1.75);
  });

  it('round trips a number too large to write in full', () => {
    expect(parsePrismaCursor(formatPrismaCursor({ n: 1e21 }, 'n'))).toBe(1e21);
  });

  it('round trips an integer and a negative number', () => {
    expect(parsePrismaCursor(formatPrismaCursor({ n: 42 }, 'n'))).toBe(42);
    expect(parsePrismaCursor(formatPrismaCursor({ n: -5 }, 'n'))).toBe(-5);
  });
});

// A `Decimal` from prisma carries more digits than a `number` holds. This is the shape of it the
// encoder reads, without the dependency.
class FakeDecimal {
  constructor(private readonly digits: string) {}

  toFixed() {
    return this.digits;
  }

  // A `Decimal` prints its exact digits, which is what `serializeID` writes into a node id.
  toString() {
    return this.digits;
  }
}

describe('compound cursors', () => {
  const fields = ['a', 'b'];
  const format = (record: Record<string, unknown>) => formatPrismaCursor(record, fields);
  const parse = parseCompositeCursor(fields);

  // The compound form used to be `JSON.stringify` of the raw values, which throws on a bigint:
  // a `@@unique` containing a bigint column failed on every edge of every page.
  it('round trips a bigint', () => {
    const record = { a: BigInt('9007199254740993'), b: 1 };

    expect(parse(format(record))).toEqual(record);
  });

  // JSON wrote a Date out as an ISO string and read it back as one, so the type was gone by the
  // time it reached prisma.
  it('round trips a date with its milliseconds', () => {
    const record = { a: new Date(1_700_000_000_123), b: 1 };
    const parsed = parse(format(record)) as { a: Date };

    expect(parsed).toEqual(record);
    expect(parsed.a).toBeInstanceOf(Date);
    expect(parsed.a.getTime()).toBe(1_700_000_000_123);
  });

  it('round trips bytes that are not valid UTF-8', () => {
    const key = new Uint8Array([0, 1, 2, 250, 255]);
    const parsed = parse(format({ a: key, b: 1 })) as { a: Uint8Array };

    expect([...parsed.a]).toEqual([...key]);
  });

  // A decimal comes back as its exact digits rather than as a `Decimal`; prisma takes a decimal
  // string wherever it takes a `Decimal`, and no digit is lost.
  it('round trips a high precision decimal', () => {
    const digits = '0.1234567890123456789012345';

    expect(parse(format({ a: new FakeDecimal(digits), b: 1 }))).toEqual({ a: digits, b: 1 });
  });

  it('round trips a JSON value', () => {
    const record = { a: { nested: [1, 'two'] }, b: 1 };

    expect(parse(format(record))).toEqual(record);
  });

  it('round trips a fractional number and one too large to write in full', () => {
    expect(parse(format({ a: 1.75, b: 1e21 }))).toEqual({ a: 1.75, b: 1e21 });
  });

  it('rejects a cursor of the wrong width', () => {
    expect(() => parse(formatPrismaCursor({ a: 1, b: 2, c: 3 }, ['a', 'b', 'c']))).toThrow(
      'Expected compound cursor to contain 2 elements, but got 3',
    );
  });
});

describe('cursors issued before this release', () => {
  // Every form the plugin could write before compound values were tagged. A client holding one
  // of these hands it straight back, so each has to parse to what it always did.
  it.each([
    ['a string', 'GPC:S:hello', 'hello'],
    ['an empty string', 'GPC:S:', ''],
    ['a number', 'GPC:N:1.75', 1.75],
    ['a number too large to write in full', 'GPC:N:1e+21', 1e21],
    ['a date', 'GPC:D:1700000000123', new Date(1_700_000_000_123)],
    ['a bigint', 'GPC:I:9007199254740993', BigInt('9007199254740993')],
  ])('reads %s', (_name, decoded, expected) => {
    expect(parsePrismaCursor(Buffer.from(decoded).toString('base64'))).toEqual(expected);
  });

  // `GPC:J:` is the compound form: a bare JSON array, so every part arrives as whatever JSON
  // preserved. That is exactly what it used to produce, and what the query it builds expects.
  it('reads a compound cursor of numbers', () => {
    const legacy = Buffer.from('GPC:J:[1,2]').toString('base64');

    expect(parseCompositeCursor(['a', 'b'])(legacy)).toEqual({ a: 1, b: 2 });
  });

  it('reads a compound cursor of strings', () => {
    const legacy = Buffer.from('GPC:J:["2","2"]').toString('base64');

    expect(parseCompositeCursor(['a', 'b'])(legacy)).toEqual({ a: '2', b: '2' });
  });

  it('reads a compound cursor holding a date, still as the string JSON left behind', () => {
    const legacy = Buffer.from('GPC:J:["2023-11-14T22:13:20.123Z",2]').toString('base64');

    expect(parseCompositeCursor(['a', 'b'])(legacy)).toEqual({
      a: '2023-11-14T22:13:20.123Z',
      b: 2,
    });
  });

  it('still rejects a cursor of the wrong width', () => {
    const legacy = Buffer.from('GPC:J:[1,2,3]').toString('base64');

    expect(() => parseCompositeCursor(['a', 'b'])(legacy)).toThrow(
      'Expected compound cursor to contain 2 elements, but got 3',
    );
  });

  it('still rejects a cursor that is not base64, and one with an unknown tag', () => {
    expect(() => parsePrismaCursor('not a cursor')).toThrow('Invalid cursor: not a cursor');
    expect(() => parsePrismaCursor(Buffer.from('GPC:Q:1').toString('base64'))).toThrow(
      'Invalid cursor',
    );
    expect(() => parsePrismaCursor(Buffer.from('DC:N:1').toString('base64'))).toThrow(
      'Invalid cursor',
    );
  });
});

describe('node ids', () => {
  it('round trips a DateTime id with its milliseconds', () => {
    const builder = builderFor([{ name: 'at', type: 'DateTime', isId: true }]);
    const at = new Date(1_700_000_000_123);

    const id = getDefaultIDSerializer('Model', 'at', builder)({ at }) as string;

    expect(getDefaultIDParser('Model', 'at', builder)(id)).toEqual(at);
  });

  it('reads a DateTime id written before it was serialized as ISO', () => {
    const builder = builderFor([{ name: 'at', type: 'DateTime', isId: true }]);
    const at = new Date(1_700_000_000_000);

    expect(getDefaultIDParser('Model', 'at', builder)(String(at))).toEqual(at);
  });

  it('round trips a Bytes id', () => {
    const builder = builderFor([{ name: 'key', type: 'Bytes', isId: true }]);
    const key = new Uint8Array([1, 2, 250]);

    const id = getDefaultIDSerializer('Model', 'key', builder)({ key }) as string;

    expect(getDefaultIDParser('Model', 'key', builder)(id)).toEqual(Buffer.from(key));
  });

  it('round trips a compound id whose parts are not strings', () => {
    const builder = builderFor(
      [
        { name: 'key', type: 'Bytes' },
        { name: 'meta', type: 'Json' },
        { name: 'n', type: 'Int' },
      ],
      { name: null, fields: ['key', 'meta', 'n'] },
    );
    const key = new Uint8Array([1, 2, 250]);

    const id = getDefaultIDSerializer(
      'Model',
      'key_meta_n',
      builder,
    )({
      key,
      meta: { a: 1 },
      n: 3,
    }) as string;

    expect(getDefaultIDParser('Model', 'key_meta_n', builder)(id)).toEqual({
      key: Buffer.from(key),
      meta: { a: 1 },
      n: 3,
    });
  });
});

describe('decimal node ids', () => {
  // More digits than a `number` holds. The serializer already writes them all out; the parser
  // used to read them back through `Number.parseFloat` and round them away, so the id named a
  // value the row does not have.
  const digits = '0.1234567890123456789012345';

  it('round trips a Decimal id without losing digits', () => {
    const builder = builderFor([{ name: 'amount', type: 'Decimal', isId: true }]);

    const id = getDefaultIDSerializer(
      'Model',
      'amount',
      builder,
    )({
      amount: new FakeDecimal(digits),
    }) as string;

    expect(id).toBe(digits);
    expect(getDefaultIDParser('Model', 'amount', builder)(id)).toBe(digits);
  });

  it('round trips a compound id containing a Decimal without losing digits', () => {
    const builder = builderFor(
      [
        { name: 'amount', type: 'Decimal' },
        { name: 'n', type: 'Int' },
      ],
      { name: null, fields: ['amount', 'n'] },
    );

    const id = getDefaultIDSerializer(
      'Model',
      'amount_n',
      builder,
    )({ amount: new FakeDecimal(digits), n: 1 }) as string;

    expect(getDefaultIDParser('Model', 'amount_n', builder)(id)).toEqual({ amount: digits, n: 1 });
  });

  // A `Float` column really is a double, so it keeps reading back as a number.
  it('still reads a Float id as a number', () => {
    const builder = builderFor([{ name: 'views', type: 'Float', isId: true }]);

    expect(getDefaultIDParser('Model', 'views', builder)('1.75')).toBe(1.75);
  });
});

// Every id the plugin can already issue and read has to keep the bytes it has: a client holding
// one hands it straight back, and a stored id has to keep naming the same row.
describe('ids issued before this release', () => {
  const intBuilder = builderFor([{ name: 'id', type: 'Int', isId: true }]);
  const stringBuilder = builderFor([{ name: 'slug', type: 'String', isId: true }]);
  const compoundBuilder = builderFor(
    [
      { name: 'id', type: 'Int' },
      { name: 'slug', type: 'String' },
    ],
    { name: null, fields: ['id', 'slug'] },
  );
  const decimalBuilder = builderFor([{ name: 'amount', type: 'Decimal', isId: true }]);

  it('writes an Int id, a String id and a compound id byte for byte as it always has', () => {
    expect(getDefaultIDSerializer('Model', 'id', intBuilder)({ id: 42 })).toBe('42');
    expect(getDefaultIDSerializer('Model', 'slug', stringBuilder)({ slug: 'ada' })).toBe('ada');
    expect(
      getDefaultIDSerializer('Model', 'id_slug', compoundBuilder)({ id: 42, slug: 'ada' }),
    ).toBe('["42","ada"]');
  });

  it('writes a Decimal id byte for byte as it always has', () => {
    expect(
      getDefaultIDSerializer('Model', 'amount', decimalBuilder)({ amount: new FakeDecimal('1.5') }),
    ).toBe('1.5');
  });

  it('reads an Int id, a String id and a compound id back to exactly what it always did', () => {
    expect(getDefaultIDParser('Model', 'id', intBuilder)('42')).toBe(42);
    expect(getDefaultIDParser('Model', 'slug', stringBuilder)('ada')).toBe('ada');
    expect(getDefaultIDParser('Model', 'id_slug', compoundBuilder)('["42","ada"]')).toEqual({
      id: 42,
      slug: 'ada',
    });
  });

  // A `Decimal` that a double holds exactly now reads back as its digits rather than as a
  // `number`. Prisma takes a decimal string wherever it takes a `Decimal`, and the value it
  // names is the one the old id named.
  it('reads a Decimal id back to the same value it always named', () => {
    expect(Number(getDefaultIDParser('Model', 'amount', decimalBuilder)('1.5'))).toBe(1.5);
  });
});
