// Step 1 — your first prisma-next-backed GraphQL type.
//
// What's wired up across the four authored files:
//   • builder.ts — `new SchemaBuilder({ plugins: [PrismaNextPlugin], … })`
//     with the contract threaded through `SchemaTypes['PrismaNextContract']`.
//   • db.ts     — `sqlite<Contract>({ contractJson, middleware: [...] })`.
//     The `capturePlaygroundSql` middleware in there is what populates
//     the SQL / Prisma query AST tabs in the response pane.
//   • schema.ts — defines a GraphQL type from a contract model and
//     exposes one Query field.
//
// Run the queries on the right to see how `db.orm.User` (a prisma-next
// Collection) plus the GraphQL selection set collapse into a single
// SQL statement against the seeded sqlite database.

import { builder } from './builder';
import { db } from './db';

// `builder.prismaObject('User', …)` registers a GraphQL type whose
// parent shape is inferred from the contract's `User` row — no manual
// type parameter, no row type imported from the client. Everything
// (column names, FK metadata, nullability) flows from `contract.json`.
//
// `select: ['id']` is a type-level dependency: every field's resolver
// sees `parent.id` regardless of what the GraphQL query asks for.
// Included here to show the syntax — the runtime always loads the
// primary key anyway, so this only changes what TypeScript sees.
builder.prismaObject('User', {
  select: ['id'],
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    email: t.exposeString('email'),
  }),
});

builder.queryType({
  fields: (t) => ({
    // The resolver returns a prisma-next `Collection` (`db.orm.User`).
    // The plugin reads the GraphQL selection set, layers `.select(...)`
    // onto the collection, and materialises via `.all()` for list
    // outputs (`.first()` for non-list / `.first({ throwIfEmpty: true })`
    // for non-null single types). No manual `.all()` in user code.
    users: t.prismaField({
      type: ['User'],
      resolve: () => db.orm.User,
    }),
  }),
});

export const schema = builder.toSchema();
