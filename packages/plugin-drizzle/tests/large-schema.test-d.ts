import SchemaBuilder from '@pothos/core';
import { defineRelations } from 'drizzle-orm';
import { getTableConfig, integer, pgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin from '../src';

const tables = {
  table0: pgTable('table0', { id: integer().primaryKey() }),
  table1: pgTable('table1', { id: integer().primaryKey() }),
  table2: pgTable('table2', { id: integer().primaryKey() }),
  table3: pgTable('table3', { id: integer().primaryKey() }),
  table4: pgTable('table4', { id: integer().primaryKey() }),
  table5: pgTable('table5', { id: integer().primaryKey() }),
  table6: pgTable('table6', { id: integer().primaryKey() }),
  table7: pgTable('table7', { id: integer().primaryKey() }),
  table8: pgTable('table8', { id: integer().primaryKey() }),
  table9: pgTable('table9', { id: integer().primaryKey() }),
  table10: pgTable('table10', { id: integer().primaryKey() }),
  table11: pgTable('table11', { id: integer().primaryKey() }),
  table12: pgTable('table12', { id: integer().primaryKey() }),
  table13: pgTable('table13', { id: integer().primaryKey() }),
  table14: pgTable('table14', { id: integer().primaryKey() }),
  table15: pgTable('table15', { id: integer().primaryKey() }),
  table16: pgTable('table16', { id: integer().primaryKey() }),
  table17: pgTable('table17', { id: integer().primaryKey() }),
  table18: pgTable('table18', { id: integer().primaryKey() }),
  table19: pgTable('table19', { id: integer().primaryKey() }),
  table20: pgTable('table20', { id: integer().primaryKey() }),
  table21: pgTable('table21', { id: integer().primaryKey() }),
  table22: pgTable('table22', { id: integer().primaryKey() }),
  table23: pgTable('table23', { id: integer().primaryKey() }),
  table24: pgTable('table24', { id: integer().primaryKey() }),
  table25: pgTable('table25', { id: integer().primaryKey() }),
  table26: pgTable('table26', { id: integer().primaryKey() }),
  table27: pgTable('table27', { id: integer().primaryKey() }),
  table28: pgTable('table28', { id: integer().primaryKey() }),
  table29: pgTable('table29', { id: integer().primaryKey() }),
  table30: pgTable('table30', { id: integer().primaryKey() }),
  table31: pgTable('table31', { id: integer().primaryKey() }),
  table32: pgTable('table32', { id: integer().primaryKey() }),
  table33: pgTable('table33', { id: integer().primaryKey() }),
  table34: pgTable('table34', { id: integer().primaryKey() }),
  table35: pgTable('table35', { id: integer().primaryKey() }),
  table36: pgTable('table36', { id: integer().primaryKey() }),
  table37: pgTable('table37', { id: integer().primaryKey() }),
  table38: pgTable('table38', { id: integer().primaryKey() }),
  table39: pgTable('table39', { id: integer().primaryKey() }),
  table40: pgTable('table40', { id: integer().primaryKey() }),
  table41: pgTable('table41', { id: integer().primaryKey() }),
  table42: pgTable('table42', { id: integer().primaryKey() }),
  table43: pgTable('table43', { id: integer().primaryKey() }),
  table44: pgTable('table44', { id: integer().primaryKey() }),
  table45: pgTable('table45', { id: integer().primaryKey() }),
  table46: pgTable('table46', { id: integer().primaryKey() }),
  table47: pgTable('table47', { id: integer().primaryKey() }),
  table48: pgTable('table48', { id: integer().primaryKey() }),
  table49: pgTable('table49', { id: integer().primaryKey() }),
  table50: pgTable('table50', { id: integer().primaryKey() }),
  table51: pgTable('table51', { id: integer().primaryKey() }),
  table52: pgTable('table52', { id: integer().primaryKey() }),
  table53: pgTable('table53', { id: integer().primaryKey() }),
  table54: pgTable('table54', { id: integer().primaryKey() }),
  table55: pgTable('table55', { id: integer().primaryKey() }),
  table56: pgTable('table56', { id: integer().primaryKey() }),
  table57: pgTable('table57', { id: integer().primaryKey() }),
  table58: pgTable('table58', { id: integer().primaryKey() }),
  table59: pgTable('table59', { id: integer().primaryKey() }),
  table60: pgTable('table60', { id: integer().primaryKey() }),
  table61: pgTable('table61', { id: integer().primaryKey() }),
  table62: pgTable('table62', { id: integer().primaryKey() }),
  table63: pgTable('table63', { id: integer().primaryKey() }),
  table64: pgTable('table64', { id: integer().primaryKey() }),
  table65: pgTable('table65', { id: integer().primaryKey() }),
  table66: pgTable('table66', { id: integer().primaryKey() }),
  table67: pgTable('table67', { id: integer().primaryKey() }),
  table68: pgTable('table68', { id: integer().primaryKey() }),
  table69: pgTable('table69', { id: integer().primaryKey() }),
  table70: pgTable('table70', { id: integer().primaryKey() }),
  table71: pgTable('table71', { id: integer().primaryKey() }),
  table72: pgTable('table72', { id: integer().primaryKey() }),
  table73: pgTable('table73', { id: integer().primaryKey() }),
  table74: pgTable('table74', { id: integer().primaryKey() }),
  table75: pgTable('table75', { id: integer().primaryKey() }),
  table76: pgTable('table76', { id: integer().primaryKey() }),
  table77: pgTable('table77', { id: integer().primaryKey() }),
  table78: pgTable('table78', { id: integer().primaryKey() }),
  table79: pgTable('table79', { id: integer().primaryKey() }),
};
const relations = defineRelations(tables);
const db = drizzle('postgres://localhost/test', { relations });
const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
  plugins: [DrizzlePlugin],
  scopeAuth: { authScopes: () => ({}) },
  drizzle: { client: db, relations, getTableConfig },
});
builder.queryType({
  fields: (t) => ({
    hello: t.string({ resolve: () => 'world' }),
  }),
});

it('preserves builder types with many tables', () => {
  expectTypeOf(builder).not.toBeAny();
});

new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
  plugins: [DrizzlePlugin],
  scopeAuth: { authScopes: () => ({}) },
  drizzle: { client: () => db, relations, getTableConfig },
});

it('requires SQL construction methods on large-schema clients', () => {
  type Client = Exclude<typeof builder.options.drizzle.client, (...args: never[]) => unknown>;
  // @ts-expect-error missing from
  const missingFrom: Client = { ...db, select: () => ({}) };
  const missingJoin: Client = {
    ...db,
    // @ts-expect-error missing innerJoin
    select: () => ({ from: () => ({ where: () => tables.table0 }) }),
  };
  const missingWhere: Client = {
    ...db,
    // @ts-expect-error missing where
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => tables.table0 }) }) }),
  };
  expectTypeOf(missingFrom).toEqualTypeOf<Client>();
  expectTypeOf(missingJoin).toEqualTypeOf<Client>();
  expectTypeOf(missingWhere).toEqualTypeOf<Client>();
});
