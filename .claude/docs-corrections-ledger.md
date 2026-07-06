# Docs corrections ledger

Maintainer feedback that is binding on all docs work. Every entry is either a
factual correction, an editorial stance, or an anti-pattern with a concrete
example. New docs writing MUST be checked against this ledger; violating an
entry is a review-blocking defect. Entries accrete — never delete, only add.

## Factual corrections (from maintainer review, 2026-07-06)

- **F1 — SchemaBuilder constructor vs generic.** "The constructor argument
  carries the runtime config that has to match the generic" is NOT accurate.
  The exact relationship between `SchemaTypes` generic entries and constructor
  options must be documented from source before being described again
  (see dossier: schema-builder). Do not hand-wave a symmetry that isn't there.
- **F2 — SchemaTypes-registered ("builder types") object registration is NOT
  the mechanism Prisma/Drizzle use to wire type names to ORM model names.**
  That is a separate mechanism. Registering types on the `Objects`/`Interfaces`
  generics is really for centralizing your type definitions.
- **F3 — `implement` is not "where fields go".** `implement` simply takes the
  remaining options for an object type (of which `fields` is one). Object
  options are split between ref creation and `implement` — the docs must
  explain that split explicitly (currently nowhere).
- **F4 — Class-backed object types** don't just "infer the backing model":
  classes also enable resolving abstract types (interfaces/unions) with
  `instanceof` checks. This is a first-class affordance, not a leftover.

- **F5 — objectRef is NOT the only way to attach a backing model without the
  SchemaTypes generic.** Class-backed types (`builder.objectType(MyClass, ...)`)
  also attach a backing model without registering anything on the generic.
  (Found during the F1-F4 correction pass, 2026-07-06.)

## Editorial stances (binding)

- **S1 — No style is "older" or second-class.** objectRef, class-backed, and
  SchemaTypes-registered styles are all completely valid. Classes are actually
  great when you already have classes representing your data. Do not write
  "reach for them only when…" framing. Present objectRef as the common default
  the docs use, without demoting the others.
- **S2 — Define by what things are and do**, never negation-first (see style
  guide positioning addendum).
- **S3 — Example choice is pedagogy.** A first example must be an obviously
  natural object type for the concept being taught ("Race" was flagged as a
  weak first object type). Choose examples a working developer would actually
  model.
- **S4 — Concept order matters more than page-local polish.** Backing models
  were introduced on schema-builder before the reader had context — a
  curriculum error. When a concept is mentioned (e.g. "the generic argument"),
  show it, don't just name it.

## Anti-slop rubric (negative exemplars from maintainer comments)

- **A1** — "The package won't refuse to compile, but the guarantees stop
  holding." Hollow aphorism: confident rhythm, near-zero information. Ban this
  register. If a sentence sounds quotable but a reader can't act on it,
  rewrite it as a concrete statement of what actually happens.
- **A2** — "graphql is the peer dependency Pothos builds on." Awkward,
  inverted phrasing. Say it plainly: "Pothos has a single peer dependency:
  `graphql`."
- **A3** — "Expose properties, return lists, mark fields nullable, and compute
  values from the backing object." Verb-list descriptions that summarize
  headings instead of saying anything.
- **A4** — General standard: prose must read like a human expert explaining to
  a peer. Symptoms of failure: formula-filled sections (identical opening
  rhythm page after page), aphorisms (A1), inverted constructions (A2),
  verb-list summaries (A3), and confident claims not traceable to source.

## UI notes (separate track)

- **U1** — Docs page header is inefficient: section + title + description +
  action buttons push content ~2/3 down the viewport. Tighten.
- **U2** — "Open in LLM" button has no practical use; "Copy Markdown" nearly
  useless. Remove from the header; consider a sidebar utility group alongside
  an "Edit on GitHub" link.
