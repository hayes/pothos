# Prisma ORM 8 playground database

A small publishing API using `@pothos/plugin-prisma-next`.

- `schema.prisma` is the source of `contract.json` and `contract.d.ts`. Regenerate them with
  `pnpm generate:prisma-next` in `website/`.
- `database.ts` seeds the `publishing.db` SQLite file and creates the ORM client. In the browser
  that file lives in memory, so rebuilding the schema restores the seed data.
- `types/` defines GraphQL types; `queries.ts` defines root lookups.

The browser has no `node:sqlite`, so the playground provides that module with SQL.js, loaded from
a CDN. The **SQL** response tab shows each statement an operation ran.
