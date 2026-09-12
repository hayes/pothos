import SchemaBuilder from '@pothos/core';
import { getColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import DrizzlePlugin, { drizzleConnectionHelpers } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';

const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
}>({
  plugins: [DrizzlePlugin],
  drizzle: { client: db, relations, getTableConfig },
});

// `orderBy` callbacks are documented to receive the Drizzle table, the same object root
// connections pass, so `getColumns(table)` has to work here too.
it('passes the drizzle table to a helper orderBy callback', () => {
  const helpers = drizzleConnectionHelpers(builder, 'comments', {
    query: { orderBy: (table) => [getColumns(table).id] },
  });

  expect(helpers.getQuery({ first: 1 }, {}, () => ({}))).toMatchObject({
    orderBy: { id: 'asc' },
  });
});
