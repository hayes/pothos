import { describe, expect, it } from 'vitest';
import {
  formatPrismaCursor,
  getConnectionOrderBy,
  getCursorParser,
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
      'Invalid cursor.',
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

    expect(() => parseCompositeCursor(['a', 'b'])(legacy)).toThrow('Invalid cursor.');
  });

  it('still rejects a cursor that is not base64, and one with an unknown tag', () => {
    expect(() => parsePrismaCursor('not a cursor')).toThrow(/^Invalid cursor\.$/);
    expect(() => parsePrismaCursor(Buffer.from('GPC:Q:1').toString('base64'))).toThrow(
      'Invalid cursor.',
    );
    expect(() => parsePrismaCursor(Buffer.from('DC:N:1').toString('base64'))).toThrow(
      'Invalid cursor.',
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

  it('still reads a Float id as a number', () => {
    const builder = builderFor([{ name: 'views', type: 'Float', isId: true }]);

    expect(getDefaultIDParser('Model', 'views', builder)('1.75')).toBe(1.75);
  });
});

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

  it('reads a Decimal id back to the same value it always named', () => {
    expect(Number(getDefaultIDParser('Model', 'amount', decimalBuilder)('1.5'))).toBe(1.5);
  });
});

const encode = (payload: string) => Buffer.from(`GPC:${payload}`).toString('base64');

// Every scalar type a cursor column can have. Each accepted form is one the plugin writes, now or
// in a cursor issued before compound values were tagged, and each reaches prisma unchanged except
// a `J:` date string, which is read into the Date it names.
describe('cursor values checked against the column type', () => {
  const at = new Date(1_700_000_000_123);
  const cases: [type: string, accepted: [string, unknown][], rejected: string[]][] = [
    [
      'Int',
      [
        ['N:42', 42],
        ['N:-5', -5],
      ],
      ['S:42', 'N:1.5', 'N:9007199254740993', 'N:x', 'I:1', 'Z:', 'O:true'],
    ],
    [
      'BigInt',
      [
        ['I:9007199254740993', BigInt('9007199254740993')],
        ['I:9223372036854775807', BigInt('9223372036854775807')],
        ['I:-9223372036854775808', BigInt('-9223372036854775808')],
        ['N:7', 7],
      ],
      ['S:7', 'N:7.5', 'N:x', 'Z:', 'I:9223372036854775808', 'I:-9223372036854775809'],
    ],
    [
      'Float',
      [
        ['N:1.75', 1.75],
        ['N:1e+21', 1e21],
      ],
      ['S:1.75', 'N:Infinity', 'N:x', 'I:1'],
    ],
    [
      'Decimal',
      [
        ['M:0.1234567890123456789012345', '0.1234567890123456789012345'],
        ['M:-1.5', '-1.5'],
        ['N:1.5', 1.5],
      ],
      ['M:abc', 'M:0x1', 'M:Infinity', 'S: 1', 'I:1'],
    ],
    [
      'String',
      [
        ['S:hello', 'hello'],
        ['S:', ''],
      ],
      ['N:1', 'O:true', 'Z:'],
    ],
    [
      'Boolean',
      [
        ['O:true', true],
        ['O:false', false],
      ],
      ['S:true', 'N:1', 'Z:'],
    ],
    [
      'DateTime',
      [
        [`D:${Number(at)}`, at],
        [`S:${at.toISOString()}`, at],
      ],
      [
        'D:x',
        'N:1700000000123',
        'S:garbage',
        'Z:',
        'S:1',
        'S:2020',
        'S:2023-11-14',
        'S:2023-13-14T22:13:20.123Z',
        `S:${String(at)}`,
      ],
    ],
    ['Bytes', [['B:AAH6', Buffer.from([0, 1, 250])]], ['S:AAH6', 'O:[0,1,250]', 'Z:']],
    // An enum is a string; the datamodel the plugin reads does not list its values.
    ['Role', [['S:ADMIN', 'ADMIN']], ['N:1', 'O:true', 'Z:']],
    // A type the plugin has no rule for is passed on unchecked.
    [
      'Unsupported',
      [
        ['S:x', 'x'],
        ['N:1', 1],
      ],
      [],
    ],
  ];

  const parserFor = (type: string) =>
    getCursorParser(
      'Model',
      builderFor([{ name: 'v', type, kind: type === 'Role' ? 'enum' : 'scalar', isUnique: true }]),
      'v',
    );

  it.each(
    cases.flatMap(([type, accepted]) => accepted.map(([payload, value]) => [type, payload, value])),
  )('%s accepts %s', (type, payload, value) => {
    expect(parserFor(type as string)(encode(payload as string))).toEqual({ v: value });
  });

  it.each(
    cases.flatMap(([type, , rejected]) => rejected.map((payload) => [type, payload])),
  )('%s rejects %s', (type, payload) => {
    expect(() => parserFor(type)(encode(payload))).toThrow(/^Invalid cursor\.$/);
  });

  const compound = builderFor(
    [
      { name: 'at', type: 'DateTime' },
      { name: 'n', type: 'Int' },
    ],
    { name: null, fields: ['at', 'n'] },
  );
  const parseCompound = getCursorParser('Model', compound, 'at_n');

  it('reads the date string in a J: compound cursor as that date', () => {
    expect(parseCompound(encode('J:["2023-11-14T22:13:20.123Z",2]'))).toEqual({
      at_n: { at: new Date('2023-11-14T22:13:20.123Z'), n: 2 },
    });
  });

  it('reads a T: compound cursor', () => {
    expect(parseCompound(formatPrismaCursor({ at, n: 2 }, ['at', 'n']))).toEqual({
      at_n: { at, n: 2 },
    });
  });

  it('checks an enum part of a compound cursor', () => {
    const parse = getCursorParser(
      'Model',
      builderFor(
        [
          { name: 'role', type: 'Role', kind: 'enum' },
          { name: 'n', type: 'Int' },
        ],
        { name: null, fields: ['role', 'n'] },
      ),
      'role_n',
    );

    expect(parse(encode('J:["ADMIN",2]'))).toEqual({ role_n: { role: 'ADMIN', n: 2 } });
    expect(() => parse(encode('J:[1,2]'))).toThrow(/^Invalid cursor\.$/);
  });

  it.each([
    'J:["not a date",2]',
    'J:["2020",2]',
    'J:["2023-11-14T22:13:20.123Z","2"]',
    'J:["2023-11-14T22:13:20.123Z"]',
    'T:[null,"N:2"]',
    'S:x',
  ])('rejects the compound cursor %s', (payload) => {
    expect(() => parseCompound(encode(payload))).toThrow(/^Invalid cursor\.$/);
  });
});

describe('node ids checked against the field type', () => {
  const at = new Date(1_700_000_000_000);
  const cases: [type: string, accepted: [string, unknown][], rejected: string[]][] = [
    [
      'Int',
      [
        ['42', 42],
        ['-5', -5],
        ['0', 0],
      ],
      ['', 'abc', '1abc', '1.9', '1e0', '01', ' 1', '9007199254740993'],
    ],
    [
      'BigInt',
      [
        ['9007199254740993', BigInt('9007199254740993')],
        ['-1', BigInt(-1)],
        ['9223372036854775807', BigInt('9223372036854775807')],
        ['-9223372036854775808', BigInt('-9223372036854775808')],
      ],
      ['', 'abc', '1n', '0x1', '1.5', ' 1', '9223372036854775808', '-9223372036854775809'],
    ],
    [
      'Float',
      [
        ['1.75', 1.75],
        ['1e+21', 1e21],
        ['1e-7', 1e-7],
        ['-2', -2],
      ],
      ['', 'abc', '1abc', 'Infinity', 'NaN', '1e400', '0x1'],
    ],
    [
      'Decimal',
      [
        ['0.1234567890123456789012345', '0.1234567890123456789012345'],
        ['1e-7', '1e-7'],
        ['1.23e+21', '1.23e+21'],
      ],
      ['', 'abc', '1abc', 'Infinity', '0x1'],
    ],
    [
      'Boolean',
      [
        ['true', true],
        ['false', false],
      ],
      ['', 'TRUE', '1', 'yes'],
    ],
    [
      'DateTime',
      [
        [at.toISOString(), at],
        [String(at), at],
        ['Tue Nov 14 2023 22:13:20 GMT+0000 (Coordinated Universal Time)', at],
        ['Tue Nov 14 2023 23:13:20 GMT+0100 (Mitteleuropäische Normalzeit)', at],
        ['Tue Nov 14 2023 22:13:20 GMT+0000', at],
      ],
      [
        '',
        'garbage',
        '1',
        'foo 1',
        '2020',
        '2023-11-14',
        'Tue Nov 14 2023',
        '2023-13-14T22:13:20Z',
      ],
    ],
    [
      'Bytes',
      [
        ['AAH6', Buffer.from([0, 1, 250])],
        ['', Buffer.from([])],
      ],
      ['AAH', '!!!!', 'AAH6\n'],
    ],
    [
      'Json',
      [
        ['{"a":1}', { a: 1 }],
        ['"x"', 'x'],
      ],
      ['', '{a:1}'],
    ],
    [
      'String',
      [
        ['ada', 'ada'],
        ['', ''],
      ],
      [],
    ],
    ['Role', [['ADMIN', 'ADMIN']], []],
  ];

  const parserFor = (type: string) =>
    getDefaultIDParser(
      'Model',
      'v',
      builderFor([{ name: 'v', type, kind: type === 'Role' ? 'enum' : 'scalar', isId: true }]),
    );

  it.each(
    cases.flatMap(([type, accepted]) => accepted.map(([id, value]) => [type, id, value])),
  )('%s accepts %j', (type, id, value) => {
    expect(parserFor(type as string)(id as string)).toEqual(value);
  });

  it.each(
    cases.flatMap(([type, , rejected]) => rejected.map((id) => [type, id])),
  )('%s rejects %j', (type, id) => {
    expect(() => parserFor(type)(id)).toThrow(/^Invalid ID\.$/);
  });

  // An id written before compound ids serialized each part by its type, when a date part was
  // `String(date)`.
  it('reads a compound id with a date part in either form', () => {
    const builder = builderFor(
      [
        { name: 'at', type: 'DateTime' },
        { name: 'n', type: 'Int' },
      ],
      { name: null, fields: ['at', 'n'] },
    );
    const parse = getDefaultIDParser('Model', 'at_n', builder);

    expect(parse(JSON.stringify([at.toISOString(), '1']))).toEqual({ at, n: 1 });
    expect(parse(JSON.stringify([String(at), '1']))).toEqual({ at, n: 1 });
    expect(() => parse(JSON.stringify([String(at), '1x']))).toThrow(/^Invalid ID\.$/);
  });
});

describe('connection order', () => {
  const builder = builderFor([
    { name: 'id', type: 'Int', isId: true },
    { name: 'c', type: 'String', isUnique: true, isRequired: false },
  ]);

  // A nullable unique column is not a key, but the order already names the cursor, so there is
  // nothing to append.
  it('returns an order that names every cursor field as it was given', () => {
    const orderBy = { c: 'asc' };

    expect(getConnectionOrderBy('Model', builder, 'c')(orderBy)).toBe(orderBy);
  });

  it('appends the cursor ascending after an ordering that names no direction', () => {
    expect(getConnectionOrderBy('Model', builder, 'c')({ author: {} })).toEqual([
      { author: {} },
      { c: 'asc' },
    ]);
  });
});
