import { encodeCursorChunk, encodeCursorTuple } from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { formatPrismaCursor, parseCompositeCursor, parsePrismaCursor } from '../src/util/cursors';

/**
 * The anti-drift guard. The chunk encoding is written once, in `@pothos/core`; this pins this
 * plugin's cursor payload to it byte for byte, and `packages/plugin-drizzle/tests/
 * shared-cursor-encoding.test.ts` pins drizzle's to the same function with the same fixtures and
 * the same expected payloads. Between them the two plugins cannot encode a value differently
 * without one of these failing.
 *
 * That is the failure this is here to catch: the chunk encoder was written out twice, and a
 * truncation bug where `parseInt` read a float cursor as an integer was fixed in the drizzle
 * plugin and left standing in this one until a later pass found it.
 *
 * `EXPECTED` is duplicated verbatim in the drizzle file on purpose -- a reader can see the two
 * agree, and neither copy can be edited alone without its own `encodeCursorChunk` check failing.
 */
class FakeDecimal {
  constructor(private readonly digits: string) {}

  toFixed() {
    return this.digits;
  }
}

const VALUES: Record<string, unknown> = {
  string: 'hello',
  integer: 42,
  fraction: 1.75,
  huge: 1e21,
  big: BigInt('9007199254740993'),
  date: new Date('2026-08-19T21:50:45.086Z'),
  bytes: new Uint8Array([0, 1, 2, 250, 255]),
  decimal: new FakeDecimal('0.1234567890123456789012345'),
  json: { a: 1, b: [2, 3] },
  nothing: null,
};

const EXPECTED: Record<string, string> = {
  string: 'S:hello',
  integer: 'N:42',
  fraction: 'N:1.75',
  huge: 'N:1e+21',
  big: 'I:9007199254740993',
  date: 'D:1787176245086',
  bytes: 'B:AAEC+v8=',
  decimal: 'M:0.1234567890123456789012345',
  json: 'O:{"a":1,"b":[2,3]}',
  nothing: 'Z:',
};

const names = Object.keys(VALUES);

function payload(fields: string[] | string) {
  return Buffer.from(formatPrismaCursor(VALUES, fields), 'base64').toString().replace(/^GPC:/, '');
}

describe('cursor payloads are the shared encoding', () => {
  it.each(names)('writes %s the way @pothos/core does', (name) => {
    expect(payload(name)).toBe(encodeCursorChunk(VALUES[name]));
    expect(payload(name)).toBe(EXPECTED[name]);
  });

  it('writes a compound cursor the way @pothos/core does', () => {
    expect(payload(names)).toBe(encodeCursorTuple(names.map((name) => VALUES[name])));
  });

  it('writes every part of a compound cursor with its own tag', () => {
    // `nothing` is a JSON null rather than a `Z:` chunk: that is what compound cursors already
    // handed out hold, and they have to keep decoding the same way.
    expect(payload(names)).toBe(
      `T:[${names.map((name) => (VALUES[name] == null ? 'null' : JSON.stringify(EXPECTED[name]))).join(',')}]`,
    );
  });

  it('reads every part back with its type', () => {
    const parsed = parseCompositeCursor(names)(formatPrismaCursor(VALUES, names)) as Record<
      string,
      unknown
    >;

    expect(parsed.string).toBe('hello');
    expect(parsed.integer).toBe(42);
    expect(parsed.fraction).toBe(1.75);
    expect(parsed.huge).toBe(1e21);
    expect(parsed.big).toBe(BigInt('9007199254740993'));
    expect(parsed.date).toEqual(new Date('2026-08-19T21:50:45.086Z'));
    expect([...(parsed.bytes as Uint8Array)]).toEqual([0, 1, 2, 250, 255]);
    expect(parsed.decimal).toBe('0.1234567890123456789012345');
    expect(parsed.json).toEqual({ a: 1, b: [2, 3] });
    expect(parsed.nothing).toBeNull();
  });

  // The prefix is this plugin's namespace, and changing it would invalidate every cursor rather
  // than only compound ones.
  it('keeps the GPC: prefix', () => {
    expect(Buffer.from(formatPrismaCursor(VALUES, 'integer'), 'base64').toString()).toBe(
      'GPC:N:42',
    );
  });
});

describe('a null cursor value', () => {
  // A nullable column in the `@@unique` a connection's cursor names used to throw
  // "Unsupported cursor type object" while the edge was being built, which fails the whole page
  // rather than only a request that pages from that row. The drizzle plugin never threw.
  it('round trips on its own', () => {
    const cursor = formatPrismaCursor({ nothing: null }, 'nothing');

    expect(Buffer.from(cursor, 'base64').toString()).toBe('GPC:Z:');
    expect(parsePrismaCursor(cursor)).toBeNull();
  });

  it('round trips beside another value', () => {
    const cursor = formatPrismaCursor({ a: null, b: 1 }, ['a', 'b']);

    expect(parseCompositeCursor(['a', 'b'])(cursor)).toEqual({ a: null, b: 1 });
  });
});

// Boolean columns are valid members of a Prisma compound unique index.
it.each([true, false])('preserves a Boolean in compound cursors (%s)', (active) => {
  const fields = ['tenantId', 'active'];
  const row = { tenantId: 1, active };
  expect(parseCompositeCursor(fields)(formatPrismaCursor(row, fields))).toEqual(row);
  const legacy = Buffer.from(`GPC:J:${JSON.stringify([1, active])}`).toString('base64');
  expect(parseCompositeCursor(fields)(legacy)).toEqual(row);
});
