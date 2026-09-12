import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { type Column, defineRelations } from 'drizzle-orm';
import {
  bigint,
  doublePrecision,
  getTableConfig,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import DrizzlePlugin from '../src';
import { getSchemaConfig } from '../src/utils/config';
import { getIDParser, getIDSerializer } from '../src/utils/cursors';

const idTest = pgTable('node_id_values', {
  id: integer().primaryKey(),
  slug: text().notNull(),
  version: integer().notNull(),
  big: bigint({ mode: 'bigint' }).notNull(),
  at: timestamp().notNull(),
  fraction: doublePrecision().notNull().unique(),
});

const relations = defineRelations({ idTest });

const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin],
  drizzle: { client: {} as never, relations, getTableConfig },
  scopeAuth: { authScopes: () => ({}) },
});

const config = getSchemaConfig(builder);

const serialize = (fields: Column[]) => getIDSerializer(fields, config);
const parse = (fields: Column[]) => getIDParser(fields, config);

describe('already issued IDs', () => {
  it('serializes an integer scalar ID as its digits', () => {
    expect(serialize([idTest.id])({ id: 7 })).toBe('7');
  });

  it('serializes a string scalar ID verbatim', () => {
    expect(serialize([idTest.slug])({ slug: 'a-slug' })).toBe('a-slug');
  });

  it('serializes a compound integer ID as a plain JSON array of numbers', () => {
    expect(serialize([idTest.id, idTest.version])({ id: 7, version: 3 })).toBe('[7,3]');
  });

  it('serializes a compound string ID as a plain JSON array of strings', () => {
    expect(serialize([idTest.slug, idTest.id])({ slug: 'a-slug', id: 7 })).toBe('["a-slug",7]');
  });

  it('parses those IDs back into the row they came from', () => {
    expect(parse([idTest.id])('7')).toEqual({ id: 7 });
    expect(parse([idTest.slug])('a-slug')).toEqual({ slug: 'a-slug' });
    expect(parse([idTest.id, idTest.version])('[7,3]')).toEqual({ id: 7, version: 3 });
    expect(parse([idTest.slug, idTest.id])('["a-slug",7]')).toEqual({ slug: 'a-slug', id: 7 });
  });
});

describe('compound node IDs', () => {
  it('round trips a bigint', () => {
    const fields = [idTest.id, idTest.big];
    const row = { id: 1, big: BigInt('9007199254740993') };

    expect(parse(fields)(serialize(fields)(row))).toEqual(row);
  });

  it('round trips a Date', () => {
    const fields = [idTest.id, idTest.at];
    const row = { id: 1, at: new Date('2026-01-01T00:00:00.123Z') };

    expect(parse(fields)(serialize(fields)(row))).toEqual(row);
  });
});

describe('numeric node IDs', () => {
  it('round trips a non-integer scalar ID', () => {
    const fields = [idTest.fraction];
    const row = { fraction: 1.75 };

    expect(parse(fields)(serialize(fields)(row))).toEqual(row);
  });

  it('round trips a scalar ID larger than the integer notation', () => {
    const fields = [idTest.fraction];
    const row = { fraction: 1e21 };

    expect(parse(fields)(serialize(fields)(row))).toEqual(row);
  });
});
