# Drizzle playground database

This publishing API gives the Pothos guides one shared schema: users have optional profiles and
posts; posts can share media through an attachment table. Public fields filter to published posts.
Viewer fields expose only the current user's drafts.

- `tables.ts` defines the SQLite tables and Drizzle relations.
- `database.ts` initializes deterministic data using SQL.js and a SQLite proxy driver.
- `builder.ts` registers the Pothos plugins and request context type.
- `types/attachments.ts` maps attachment rows to Media nodes with per-post caption edges.
- `types/` defines GraphQL types; `queries.ts` defines root lookups.
- `schema.ts` registers the modules and exports the schema.

The database executes in the browser without credentials or an external database service. SQL.js
loads its WebAssembly module from a CDN. The proxy opens a connection for each SQL statement and
saves the database between statements; multi-statement transactions are not supported. Rebuilding
or reloading the schema creates fresh state. Application databases should use a persistent Drizzle
driver and their normal migration workflow instead of this playground bridge.

The operation fixtures cover author lookups, aliased relation queries, viewer context, pagination,
missing rows, related counts, node refetching, computed selections, conditional variants, and attachment edges with filtered cursor pagination.

After running an operation, the **Queries** response tab shows each `db.query.<table>.findFirst`,
`findMany`, and `db.$count` invocation with the arguments passed to Drizzle, including Pothos's
nested selections and fallback loads. These are snapshots at API invocation, not a count of SQL
executions. SQL remains in Console. Callbacks are shown as function source without being evaluated;
SQL objects, columns, dates, and other non-JSON values use labeled diagnostic representations.
Captures are replaced on each run and cleared when the example is reset.
