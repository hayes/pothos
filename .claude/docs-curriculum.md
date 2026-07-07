# Docs curriculum — getting-started + fundamentals

Status: DRAFT for maintainer approval. Nothing gets rewritten against this
until it's approved. Companion documents: `.claude/docs-corrections-ledger.md`
(binding corrections/stances), `.claude/docs-dossier/` (ground truth).

## Design principles

1. **One home per concept.** Every concept is TAUGHT on exactly one page (its
   home). Any other page may USE it, with at most a one-line gloss + link on
   first use within that page. "Taught twice" is a defect, not reinforcement.
2. **Teach before use — with a getting-started exception.** Within
   fundamentals, no page may use a construct whose home page comes later.
   Getting-started may use anything with a gloss + link (its job is momentum,
   not completeness), but each gloss is a deliberate, chartered choice.
3. **One world.** All getting-started + fundamentals examples live in a single
   Middle-earth compendium app with a canonical cast sheet (below). An entity
   name always means the same shape. No one-off domains.
4. **Depth belongs to the home.** Getting-started shows the minimum working
   form and links to the home page; the home page owns nuance, options, and
   edge cases. When getting-started and a fundamentals page currently share
   near-identical prose (context factory), the fundamentals page keeps the
   teaching and getting-started shrinks to the working form + link.
5. **Mentioned means taught or cut.** No concept may be name-dropped without
   either a real explanation at its home or removal. (Current violations:
   `info`, `isTypeOf`, nested inputs, `initContextCache`.)

## Canonical world (cast sheet)

The app: a Middle-earth compendium — an encyclopedia backend whose records
editors curate. All shapes below are canonical; pages may extend them but
never contradict them.

- `Character { id, name, birthYear?, biography?, editorId }` — the star
  entity. Frodo, Sam, Gandalf, Aragorn.
- `Race { id, name, lifespan }` — Hobbit, Elf, Dwarf.
- `Faction { id, name, alignment, members: [Character] }` — one shape
  everywhere (fixes the F2-vs-F13 drift). Fellowship of the Ring, Uruk-hai.
- `Battle { id, name, location, foughtOn: Date }` — for scalars.
- `Location { id, name, terrain }`, `Quote { id, text }` — for unions' search.
- Context: `ctx.user` (canonical name — `ctx.viewer` is retired), `ctx.db`,
  `ctx.pubSub` where relevant.
- Interfaces cast: `Character` specializations (Hobbit/Elf/Wizard) as today.

## Page order and charters

### Getting started (3 pages, unchanged order)

- **introduction** — the mental model. Introduces (as gestures with links, not
  homes): builder, objectRef+backing model (coins the term, one sentence,
  links to Objects as home), toSchema, plugins. Must not: enumerate styles,
  explain field builder mechanics.
- **installation** — install, strict mode (the `notStrict` truth per ledger),
  empty builder, first type. Glosses: `queryType` ("declares the root Query
  type — covered in Queries"), expose helpers (one line, link to Fields).
  THIS PAGE IS THE CALIBRATION EXEMPLAR.
- **first-server** — yoga wiring, run a query, context factory in its minimal
  working form + link to Context (which owns the teaching; today's
  near-duplicate prose gets consolidated there). Its `t.arg.string()` use
  gets a one-line gloss + link to Arguments.

### Fundamentals (14 pages — ONE move: queries goes 2nd)

New order: **schema-builder, queries, objects, fields, resolvers, context,
args, inputs, mutations, subscriptions, interfaces, unions, enums, scalars.**

Moving `queries` from 8th to 2nd resolves the corpus's largest violation
(`queryType` used on 7 pages before being taught): after it, every page's
examples may legally stand fields on the Query root.

1. **schema-builder** — home of: `new SchemaBuilder`, the constructor options
   (what they actually are, per dossier — no false generic/constructor
   symmetry), the generic *shown concretely* (ledger S4: show it where you
   name it) with a map of which entries are covered where (Context →
   Context page, Scalars → Scalars page, DefaultFieldNullability → pattern
   page), `toSchema`. REMOVED from this page: the "Backing models" section
   (moves to Objects — fixes the out-of-order comment) and the SchemaTypes
   "Pattern 2" teaching (Objects page owns styles; here at most one sentence
   + link).
2. **queries** — home of: `queryType`, `queryField`, `queryFields`, when to
   use which. Examples are scalar-only (`characterCount`, `hello`-style) so
   the page precedes Objects legally. Mutation/subscription roots are NOT
   here (their homes teach them; this page notes the parallel exists).
3. **objects** — home of: refs, `implement`, **the options split between ref
   creation and implement** (ledger F3 — new required section), backing
   models (the term's single home), returning the type, and the three
   definition styles as equals (ledger S1) with the variant switcher —
   class-backed includes the `instanceof`/`isTypeOf` affordance (F4);
   SchemaTypes registration described as centralizing definitions (F2).
   First example: `Character` (ledger S3 — Race was a weak first object;
   Race appears later on the page as the second type when relations need it).
4. **fields** — home of: expose helpers, `t.field`/computed fields, lists,
   **scalar-field nullability + the default** (new — currently taught
   nowhere), `objectField(s)` splitting. 
5. **resolvers** — home of: the 4-arg signature, including a REAL paragraph
   on `info` (what it is, when it matters, that ORM plugins use it for
   query planning — links to prisma/drizzle) or we cut the mention; applied
   backing-model (no re-teach; one gloss + link), throwing.
6. **context** — home of: what context is for, the factory (consolidates
   GS3's duplicate), what belongs on it, per-request reasoning, the
   narrowing idiom (its single home — mutations/subscriptions link here
   instead of re-teaching), `initContextCache` gets two honest sentences +
   dataloader link (or is cut). Uses `ctx.user` (canonical).
7. **args** — home of: `t.arg.*`, required/optional/defaults for args.
   The required/defaultValue mechanics are taught HERE once; inputs refers
   back ("input fields take the same options") instead of re-teaching.
8. **inputs** — home of: `inputType`, naming, sharing, `inputRef`/recursive,
   **nested inputs get a real example** (currently one orphan sentence).
   Its mutation example carries a one-line gloss + link to Mutations.
9. **mutations** — home of: `mutationType`/`mutationField`/`mutationFields`,
   row-level auth pattern, payload conventions. Narrowing: one line + link
   to Context (no third re-teach).
10. **subscriptions** — home of: `subscriptionType` (explicitly named and
    taught as the third root — currently used but never explained),
    subscribe/resolve, pub/sub, filtering, auth-at-subscribe (link to
    Context for narrowing). Its `addCharacter` example returns the entity
    (fixing the contradiction with mutations' own convention).
11. **interfaces** — home of: interfaceRef/interfaceType, implementing,
    `resolveType` (single home; unions links back), `isTypeOf` with a real
    example (class-backed `instanceof` tie-in), polymorphic queries
    including `__typename` (currently only unions mentions it).
12. **unions** — home of: `unionType`, when unions vs interfaces. resolveType:
    "same contract as interfaces" + link + only union-specific notes.
13. **enums** — as today, but `Faction` uses the canonical shape.
14. **scalars** — as today (already correctly sequenced).

## Resolution of every inventory violation

- Used-before-taught #1–4 (roots): queries moves to position 2; mutation/
  subscription roots taught at their homes which already follow all uses.
- #5 (args in GS3): chartered gloss. #6/#7 (expose/t.field in GS): chartered
  gloss. #8/#9 (signature/context): resolvers/context homes stand; GS3 keeps
  the minimal factory + link. #10 (scalar-field nullability): new section in
  fields.
- Never-fulfilled: `info` → resolvers; `isTypeOf` → interfaces (+objects
  class section); nested inputs → inputs; `initContextCache` → context or cut.
- Taught-twice A–H: each concept's home per the charters above; all other
  occurrences become gloss + link.
- Inconsistencies: `ctx.user` canonical; `Faction` canonical shape; F10's
  mutation returns the entity; `__typename` moves to interfaces.

## What this is NOT

- Not a prose spec — voice/quality is governed by the exemplar (Phase 3) and
  the anti-slop rubric in the ledger.
- Not a plugins/patterns curriculum — that's a later phase, after
  fundamentals proves the process.
