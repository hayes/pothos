# Prisma ORM 8 playground database

This small publishing API runs the unreleased `@pothos/plugin-prisma-next` plugin against the
published Prisma ORM 8 packages.

- `schema.prisma` is the source of `contract.json` and `contract.d.ts`, emitted by the ORM.
- `database.ts` seeds an in-memory database and creates the ORM client.
- `types/` defines GraphQL types; `queries.ts` defines root lookups.

The browser has no `node:sqlite`, so the playground provides that one module with SQL.js, whose
WebAssembly loads from a CDN. Every ORM package is the one published to npm. After running an
operation, the **SQL** response tab shows each statement that ran.
