# Docs review guide — grouped for one-by-one review

State as of 2026-07-07. Every group below is committed and pushed on
`mh--playground`; all gates green (65 playground refs, test:docs, 48 example
tests, next build). Review each group on http://localhost:3000 with the
review tool; every comment becomes a ledger entry as before.

## How the work was done

Full pipeline per fundamentals page: citation dossier → Opus draft →
adversarial fact-check against source → slop screen against the ledger →
orchestrator read/fix. Patterns/top-level/plugins got a preserving
"preferences pass" (ban list + F6 attributions + API-name verification
against each plugin's source), not rewrites.

## Group 1 — Getting started + Overview (4 pages) — reviewed by you already
introduction, installation (exemplar), first-server, index.mdx (Overview).
Round-4 fixes applied since your last read (callouts removed, scope trims).

## Group 2 — Fundamentals core (schema-builder, queries, objects, fields)
Reviewed by you (round 5); objects/fields revised per your notes since
(type-references-first, sugar-order). Worth a re-skim of just those two.

## Group 3 — Fundamentals: resolvers, context, args
- resolvers: executor behavior attributed to graphql-js (F6); the `info`
  paragraph kept — prisma/drizzle genuinely plan queries from it (cited).
- context: owns the factory + narrowing; initContextCache claim un-inverted.
- args: the `readonly string[]` claim was verified WRONG and fixed (mutable).

## Group 4 — Fundamentals: inputs, mutations, subscriptions
- inputs: real nested + recursive examples; isOneOf documented (2 sentences).
- mutations: "exactly once" false rule fixed; serial execution added (F6).
- subscriptions: third root taught explicitly; unverified subscribe-before-
  resolve callout dropped; addCharacter returns the entity; honest note that
  the playground validates but can't hold an event stream.

## Group 5 — Fundamentals: interfaces, unions, enums, scalars
- interfaces: Pothos's interface-field auto-merge verified and taught;
  resolveType string-only (ref returns verified NOT to work on interfaces).
- unions: resolveType referral to interfaces; search demo returns a real mix.
- enums: name-vs-value mapping was INVERTED on the old page — fixed; the
  `as const` ceremony removed (your 7c191da8 made it redundant).
- scalars: ID taught as the real Input/Output asymmetry; F6 attributions.

## Group 6 — Patterns (7 pages, preserving pass)
Fact fixes: circular-references taught a nonexistent thunk form (replaced
with builder-types string names); default-nullability wrongly said the field
flip covers args; handling-errors' plugin-errors example passed refs where
classes are required; reusable-fields cited an invented Ref<Types,T>.
DECISION FOR YOU: three patterns pages (handling-errors, printing-and-
codegen, reusable-fields) still use the sports world; inferring-types uses
Middle-earth. Unify when patterns get a curriculum, or leave.

## Group 7 — Top-level (using-plugins, troubleshooting, design, api/*, migrations, playground, llms)
api/* signatures spot-verified against core (all accurate). design.mdx's
ORM-slot sentence aligned with F2. Migrations left in their own register.

## Group 8 — Plugins (20 single pages + catalog)
Selling register stripped corpus-wide; every API name verified per plugin.
Fixed: relay prose used t.nodes (→ t.nodeList) and misplaced
globalConnectionField on `t` (it's a builder method); errors.mdx intro
contradicted its own table (errors.types takes classes). Catalog one-liners
in components/plugins/plugins.ts de-sold ("done right", "the smart way" etc.).
DECISION FOR YOU: plugins/index.mdx is a routing stub; the real catalog is
components/plugins/plugins.ts — two sources for "the plugins page."

## Group 9 — Prisma + Drizzle trees (23 pages, preserving pass)
No invented APIs found. PARITY MAP (decisions for you — writing new drizzle
sections is new content I didn't author unilaterally):
- drizzle thinner than prisma on: connections (cursor parsing/formatting,
  sharing connection objects, extending edges, total count on shared
  objects), relay "Missing records", relations "Fallback queries".
- drizzle richer than prisma on: interfaces (fields on the interface, one
  table per interface), objects "Computed fields", relations
  "Derived fields with relatedField".
- prisma-utils has no drizzle equivalent (plugin difference, not a docs gap).

## Open review-tool items (2)
- Tab-button comment: at HEAD all three tabs render identically; the only
  real difference is client-side mount of inactive panels. If the flash is
  what you saw, the fix is force-mounting all panels (global Tabs change).
- Related-docs component tracker (U5): design a component if you want
  related links back; all ad-hoc See-also callouts are gone.

## Standing flags (no action taken)
- Relay page + several plugin pages use the Ultimate League theme (plugins
  never got a curriculum; per-page coherent).
- ORM live-example scaffolding (example-stubs.ts, extension panels) still
  unused: wire-or-delete decision pending.
- PR #1565 merge is yours.
