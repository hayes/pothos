import type { Column } from 'drizzle-orm';

/**
 * Checks for the values a client hands back inside a node ID or a cursor, by the column they are
 * for, run before any SQL. Core's chunk decoding is lenient about the text; what is checked here
 * is the type of the decoded value, and for some columns its format (uuid, integer digits, dates).
 *
 * The checks are conservative: they reject only values no row of the column can hold. Driver
 * options can change the JS type a row value arrives as (numeric read as a number, integers as
 * bigints, a string-mode bigint as a number), so string-family columns also take numbers and
 * bigints, number columns bigints, and bigint columns numbers and decimal strings.
 * `column.dataType` describes the value after drizzle's codecs, which is what both a root row and
 * a nested relation row hold.
 *
 * Column types whose row values this can't pin down (json, custom types, arrays, geometry, and
 * bytes stored in a `string` column) are left unchecked, as are string formats a database parses
 * itself (numeric, date and time strings, network addresses) and enum labels: a database enum can
 * hold labels the schema's list no longer has, and drizzle reads them without checking.
 */

export const INVALID = Symbol('invalid');

type Parsed = unknown;

export interface ColumnValues {
  /** A single-column node ID, as `formatIDChunk` writes it. */
  parseID: (text: string) => Parsed;
  /** One element of a compound node ID's JSON array, as `formatCompoundIDValue` writes it. */
  parseIDPart: (value: unknown) => Parsed;
  /** A value `decodeCursorChunk` read from a tagged chunk. */
  parseCursor: (value: unknown) => Parsed;
  /** A part of a deprecated `J:` cursor: a row value after a plain JSON round trip. */
  parseLegacyCursor: (value: unknown) => Parsed;
}

/** What `getIDParser` does with a single-column ID it has no format for. */
export type UnsupportedID = 'never-serializable' | 'unparsable';

const INTEGER_RANGES: Record<string, [number, number]> = {
  int8: [-(2 ** 7), 2 ** 7 - 1],
  int16: [-(2 ** 15), 2 ** 15 - 1],
  int24: [-(2 ** 23), 2 ** 23 - 1],
  int32: [-(2 ** 31), 2 ** 31 - 1],
  // `bigint({ mode: 'number' })`: an int8 read through `Number`, which rounds past 2^53.
  int53: [-(2 ** 63), 2 ** 63],
  uint8: [0, 2 ** 8 - 1],
  uint16: [0, 2 ** 16 - 1],
  uint24: [0, 2 ** 24 - 1],
  uint32: [0, 2 ** 32 - 1],
  uint53: [0, 2 ** 64],
  year: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
};

const ZERO = BigInt(0);
const DECIMAL_INTEGER = /^(0|-?[1-9]\d*)$/;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
// Postgres writes a non-finite float inside JSON as a string, so a nested row holds one.
const NON_FINITE = new Set(['NaN', 'Infinity', '-Infinity']);

function accept(value: unknown) {
  return value;
}

function parseCanonicalNumber(text: string) {
  const value = Number(text);

  return String(value) === text ? value : INVALID;
}

function parseCanonicalDate(milliseconds: unknown) {
  if (typeof milliseconds !== 'number' || !Number.isInteger(milliseconds)) {
    return INVALID;
  }

  const date = new Date(milliseconds);

  return Number.isNaN(date.getTime()) ? INVALID : date;
}

// `JSON.stringify` writes a Date as its ISO string.
function parseISODate(value: unknown) {
  if (typeof value !== 'string') {
    return INVALID;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date.toISOString() === value ? date : INVALID;
}

function numberValues(column: Column, constraint: string | undefined): ColumnValues {
  const range = constraint ? INTEGER_RANGES[constraint] : undefined;
  // SQLite keeps any value in an integer column of a table that isn't STRICT, so a row there is
  // only known to hold a number.
  const integer = range && !column.columnType.startsWith('SQLite') ? range : undefined;

  const check = (value: unknown) => {
    // A driver can read integers as bigints (libsql's `intMode: 'bigint'`, `safeIntegers`).
    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value !== 'number') {
      // Postgres writes a non-finite float inside JSON as a string, so a nested row holds one.
      return !range && typeof value === 'string' && NON_FINITE.has(value) ? value : INVALID;
    }

    if (integer) {
      return Number.isInteger(value) && value >= integer[0] && value <= integer[1]
        ? value
        : INVALID;
    }

    // A float column holds NaN and the infinities; an integer column does not.
    return range && !Number.isFinite(value) ? INVALID : value;
  };

  return {
    parseID: (text) => check(parseCanonicalNumber(text)),
    // A compound ID writes a bigint as its digits.
    parseIDPart: (value) =>
      typeof value === 'string' && DECIMAL_INTEGER.test(value) ? value : check(value),
    parseCursor: check,
    parseLegacyCursor: check,
  };
}

function bigintValues(constraint: string | undefined): ColumnValues {
  const unsigned = constraint === 'uint64';

  const parseText = (text: unknown) => {
    if (typeof text !== 'string' || !DECIMAL_INTEGER.test(text)) {
      return INVALID;
    }

    const value = BigInt(text);

    return unsigned && value < ZERO ? INVALID : value;
  };

  // A driver option can read a bigint column as a number.
  const parse = (value: unknown) => {
    if (typeof value === 'bigint') {
      return unsigned && value < ZERO ? INVALID : value;
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) && !(unsigned && value < 0) ? value : INVALID;
    }

    return parseText(value);
  };

  return {
    parseID: parseText,
    parseIDPart: parse,
    parseCursor: parse,
    parseLegacyCursor: parse,
  };
}

/** A string column's values, which a driver option can also read as a number or bigint. */
function stringValues(check: (value: string) => boolean): ColumnValues {
  const parse = (value: unknown) => {
    if (typeof value === 'string') {
      return check(value) ? value : INVALID;
    }

    return typeof value === 'number' || typeof value === 'bigint' ? value : INVALID;
  };

  return {
    parseID: parse,
    parseIDPart: parse,
    parseCursor: parse,
    parseLegacyCursor: parse,
  };
}

const anyString = stringValues(() => true);

const dateValues: ColumnValues = {
  parseID: (text) => (DECIMAL_INTEGER.test(text) ? parseCanonicalDate(Number(text)) : INVALID),
  // Compound IDs written before 0.19.1 hold the date as JSON wrote it.
  parseIDPart: (value) =>
    typeof value === 'string' ? parseISODate(value) : parseCanonicalDate(value),
  parseCursor: (value) =>
    value instanceof Date && !Number.isNaN(value.getTime()) ? value : INVALID,
  parseLegacyCursor: parseISODate,
};

const booleanValues: ColumnValues = {
  parseID: () => INVALID,
  parseIDPart: (value) => (typeof value === 'boolean' ? value : INVALID),
  parseCursor: (value) => (typeof value === 'boolean' ? value : INVALID),
  parseLegacyCursor: (value) => (typeof value === 'boolean' ? value : INVALID),
};

const bytesValues: ColumnValues = {
  parseID: () => INVALID,
  // `JSON.stringify` writes a Buffer as `{ type: 'Buffer', data }`, which is what a compound ID
  // holds; nothing reads it back as bytes, so it is passed on as it always was.
  parseIDPart: accept,
  parseCursor: (value) => (value instanceof Uint8Array ? value : INVALID),
  parseLegacyCursor: (value) => {
    const { type, data } = (value ?? {}) as { type?: unknown; data?: unknown };

    return type === 'Buffer' &&
      Array.isArray(data) &&
      data.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
      ? Uint8Array.from(data as number[])
      : INVALID;
  },
};

const unchecked: ColumnValues = {
  parseID: accept,
  parseIDPart: accept,
  parseCursor: accept,
  parseLegacyCursor: accept,
};

function valuesFor(column: Column): ColumnValues {
  // `.array()` keeps the element's data type and only sets `dimensions`.
  if ((column as { dimensions?: number }).dimensions) {
    return unchecked;
  }

  const [type, constraint] = column.dataType.split(' ');

  switch (type) {
    case 'number':
      return numberValues(column, constraint);
    case 'bigint':
      return bigintValues(constraint);
    case 'boolean':
      return booleanValues;
    case 'object':
      if (constraint === 'date') {
        return dateValues;
      }

      return constraint === 'buffer' ? bytesValues : unchecked;
    case 'string':
      switch (constraint) {
        case undefined:
          // MySQL's `blob({ mode: 'buffer' })` reports `string` and holds a Buffer.
          return column.columnType === 'MySqlBlob' ? unchecked : anyString;
        case 'uuid':
          return stringValues((value) => UUID.test(value));
        case 'int64':
          return stringValues((value) => DECIMAL_INTEGER.test(value));
        case 'uint64':
          return stringValues((value) => DECIMAL_INTEGER.test(value) && !value.startsWith('-'));
        default:
          return anyString;
      }
    default:
      return unchecked;
  }
}

const cache = new WeakMap<Column, ColumnValues>();

export function columnValues(column: Column): ColumnValues {
  let values = cache.get(column);

  if (!values) {
    values = valuesFor(column);
    cache.set(column, values);
  }

  return values;
}

/**
 * Why a single-column node ID on `column` can't round trip, if it can't. `never-serializable`
 * columns hold values `formatIDChunk` refuses for every row, so their IDs never worked;
 * `unparsable` ones may hold a string or number that serializes, but nothing parses it back.
 */
export function unsupportedIDColumn(column: Column): UnsupportedID | undefined {
  const [type, constraint] = column.dataType.split(' ');

  if ((column as { dimensions?: number }).dimensions || type === 'array' || type === 'boolean') {
    return 'never-serializable';
  }

  if (type === 'object' && constraint !== 'date') {
    return constraint === 'buffer' ||
      constraint === 'geometry' ||
      constraint === 'point' ||
      constraint === 'line'
      ? 'never-serializable'
      : 'unparsable';
  }

  return type === 'number' || type === 'bigint' || type === 'string' || type === 'object'
    ? undefined
    : 'unparsable';
}
