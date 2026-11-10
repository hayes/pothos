// While completing a table name, the editor checks the call with every table key at once. Each
// key should then cost one check against its own table, not one against every table. The
// connection calls are linear in tsc either way; their pairwise cost on `orderBy` showed only in
// the editor's completion request, which this count can't see.
import { type DrizzleRef, drizzleConnectionHelpers } from '../../src';
import { builder, db } from './builder';

type Types = typeof builder.$inferSchemaTypes;
type ConnectionMethod = PothosSchemaTypes.QueryFieldBuilder<Types, {}>['drizzleConnection'];

declare const anyObject: Parameters<typeof builder.drizzleObjectField>[0];
declare const anyInterface: Parameters<typeof builder.drizzleInterfaceField>[0];
declare const anyConnectionType: Parameters<Exclude<ConnectionMethod, string>>[0]['type'];
declare const anyTable: DrizzleRef<Types> | keyof Types['DrizzleRelations'];

builder.drizzleObjectField(anyObject, 'label', (t) => t.string({ resolve: () => '' }));

builder.drizzleObjectFields(anyObject, (t) => ({
  label: t.string({ resolve: () => '' }),
}));

builder.drizzleInterfaceField(anyInterface, 'label', (t) => t.string({ resolve: () => '' }));

builder.drizzleInterfaceFields(anyInterface, (t) => ({
  label: t.string({ resolve: () => '' }),
}));

builder.queryFields((t) => ({
  page: t.drizzleConnection({
    type: anyConnectionType,
    resolve: (query) => db.query.table0.findMany(query()),
  }),
}));

export const pages = drizzleConnectionHelpers(builder, anyTable, {
  query: () => ({ orderBy: { id: 'asc' } }),
});
