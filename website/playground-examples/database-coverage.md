# Database documentation examples

Based on main `a966a6e6f`. This batch adds one browser application for Drizzle and one local
application for Prisma and Prisma Utils. A small plain-object-ref schema in the same Prisma project
checks the documented approach without the Prisma plugin. No database-backed playground is claimed
for Prisma.

## Design

Both applications model a small publication about community gardens. Maya and Leo each have an
unpublished draft; three published posts share a timestamp; Nora has no profile or posts. Two posts
share media uploaded by Leo. These cases make selection planning, absence, ordering, ownership and
join tables observable without creating a separate project for each guide.

The public author type exposes published posts and a consistently filtered count. The private
Viewer interface exposes the authenticated author's email and drafts, with separate editor and
author implementations. Prisma Post node lookup applies the same visibility restrictions as root
fields. Drizzle Post is not a Relay node; User is the public refetchable node.

## Browser: Drizzle

`plugin-drizzle` contains `schema.ts`, `tables.ts`, `database.ts`, and seven operations. The actual
workspace plugin and pinned Drizzle 1.0.0-rc.2 execute SQLite through SQL.js 1.14.1. SQLite runs in
WebAssembly, with no remote database, credentials, or mock ORM. Each SQL statement uses a short-lived
connection; the schema retains the serialized database and releases the WASM connection in finally.
Rebuilding or resetting the example creates fresh seeded state. This lightweight bridge does not
implement transactions spanning several statements; applications use their normal database driver.

The query runner captures SQL in Console. There is no new ORM-specific response panel or runtime
provider API. Type bundling supplies the installed Drizzle and selection-mapper declarations so
Monaco and runtime use the same API; the source checker resolves Drizzle to the website installation
to avoid duplicate class identities from pnpm's different TypeScript peer contexts.

| Operation | Observable behavior |
| --- | --- |
| 01-author | Public profile, published posts and nested author in one SQL statement. |
| 02-aliases | Opposite relation orderings remain distinct and execute two SQL statements. |
| 03-viewer | Private draft and email, both interface implementations when context changes. |
| 04-pagination | Tied timestamp ordering, published-only feed and media uploader. |
| 05-missing | Null profile, empty posts/count, absent author. |
| 06-related-pages | Filtered related count and many-to-many media connection. |
| 07-node | Refetch a public author by global ID. |

`check-database-browser.mjs` checks fresh Monaco diagnostics, operation responses and SQL counts,
then forward/backward/empty pages, count-only SQL, viewer isolation, edited seed data, reset,
sharing, an invalid column's type error, rendered docs actions, and mobile execution.
The normal browser suite also checks the operation fixtures. The dedicated check runs in
`test:browser` after the normal playground checker.

## Local: Prisma and Prisma Utils

`local-examples/prisma` uses Prisma 7.7.0 with its SQLite driver adapter. The local runner generates
the Prisma client, Pothos types and DDL from `schema.prisma`, then creates and removes a temporary
database. `prisma.config.ts` supplies the dialect configuration for migration generation.
The local package installation stages built workspace packages with resolved dependency versions,
because npm cannot consume `workspace:` ranges. GraphQL 16 remains isolated from the workspace.

The suite checks selected relations, incompatible aliases, filtered counts, missing records, both
viewer implementations, shared media/uploader, node visibility, cursor continuation/backward pages,
title filters, draft creation/update, denied writes, and nested mutation payload selections. It
also executes every authored operation file and the plain-ref schema. Prisma Utils shares the
same schema and seed instead of adding a second application.

## Documentation preservation and review

All pre-existing substantive guide content is retained. New sections connect those APIs to the
publishing schemas with source-backed excerpts and concrete outcomes. Advanced alternatives remain
literal documentation: async selection callbacks, conflicting type-level selections, custom
connection/edge types and helpers, custom node IDs, relation variant overrides, optional-plugin
integrations, and Prisma scalar-list filters (unsupported by SQLite).

Package READMEs expand the source excerpts and keep API explanations, without browser/local project
links, repository test commands or editing instructions. Existing Prisma Utils generator references
are preserved from main.

Independent design review requested separate drafts, aligned join uniqueness, removal of an unused
plugin, and an accurate name for the payload mutation; all were addressed. Independent content and
preservation review found missing setup imports, the Relay nodes setting, and a shared-media action
that omitted one of the posts; all were addressed.

Historical Prisma Next browser support was inspected at `0f2084405` and `47ac42ea2`, from the older
`mh--plugin-prisma-next` work. It used SQL.js, pregenerated contracts, seed aliases, and SQL/AST panels.
It targets Prisma Next 0.14/0.16, rather than the current private ORM8 RC9 plugin. Restoring that
runtime requires separate compatibility, contract-generation and lifecycle work; it is not included
in this batch.

## Validation evidence

- Production `build-ci` passed, including generated bundles, reference checks and website types.
- `type:examples`: 89 source files across 72 isolated programs passed.
- Full production playground checks: 72 programs and 130 browser operations passed, including
  existing mobile controls, source/step transitions, and landing-page checks.
- Rendered documentation link checking found one new overview link, which was corrected; the
  rebuilt site passes all internal page and anchor checks.
- Website unit tests: 38 passed across 13 files.
- Clean `check:local`: existing local applications plus Prisma/Utils and plain refs passed.
- All seven Drizzle browser operation fixtures passed with fresh editor diagnostics, SQL-count
  assertions, forward/backward/empty pages, viewer switching, edited data, sharing and reset.
- All five rendered Drizzle source actions passed; the mobile docs action and result passed at
  390px. Desktop and mobile screenshots were inspected.
- All 15 source-derived excerpts were checked for exact expanded parity in package READMEs.
- Independent static design/content/preservation/correctness reviews found no remaining issues
  after the fixes recorded above.

- The focused production-browser check also passed shared-code trust/build, edited database
  reconstruction, and rejection of an unknown Drizzle column by the TypeScript worker.

Logs for this run are under `/tmp/pothos-database-*.log` and `/tmp/pothos-drizzle-*.log`.
