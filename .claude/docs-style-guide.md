# Docs style guide

Status: BINDING on all docs prose. Derived from the approved calibration
exemplar (`website/content/docs/getting-started/installation.mdx`, approved
2026-07-06) and the corrections ledger (`.claude/docs-corrections-ledger.md`).
On any conflict, the ledger wins, then the exemplar, then this guide.

This guide deliberately does NOT provide sentence templates or section
formulas. The previous style guide encoded a formula and agents filled it,
which produced slop at scale. Voice is defined by imitation of the exemplar
and the maintainer's original docs, constrained by the ban list.

## The voice

Write like the maintainer's own original guide pages (see
`git show 6cd0a85c:.../guide/objects.mdx` for a reference sample, or the
approved exemplar). Concretely:

- A patient walkthrough addressed to the reader. Second person for the
  reader's actions ("you'll need to…"), "we" for the shared task
  ("Next, we can add an object type based on some data:").
- Sentences state what the code does, what it's for, and what comes next.
  They may be long and relaxed. They simply end — no punch clause, no payoff
  line, no summary flourish.
- Asides go in parentheses ("(Pothos calls this the backing model)").
- Forward references are stated plainly: "The [Fields](../fundamentals/fields)
  guide covers the field builder in more detail." Never tease.
- The reader has already chosen Pothos. Explain; never persuade. If a
  sentence's job is to make the reader feel something rather than know
  something, delete it.

A calibration excerpt from the approved exemplar (this is the bar):

> `objectRef` creates a reference to a new `Character` type. The generic
> parameter tells Pothos what TypeScript shape the data behind this type will
> have (Pothos calls this the backing model). `implement` defines the type's
> fields; `t.exposeID('id')` and `t.exposeString('name')` return properties
> directly from the backing object. The [Fields](../fundamentals/fields) guide
> covers the field builder in more detail.

## Page shape

Follow the exemplar's shape, not a template:

1. One plain intro sentence saying what the page walks through. Not a hook,
   not a value proposition.
2. Sections in teaching order. Each code block is followed by a prose
   walkthrough naming the constructs it introduced and linking each to its
   home page on first use (one-line gloss + link — the home page owns depth).
3. Pages simply end after the last teaching section. NO "Next: [page]"
   callouts and no ad-hoc "See also" link callouts — every page already has
   next/previous buttons with titles and descriptions (ledger U5; related-docs
   links, if ever wanted, get a designed component, not callouts). A callout
   is allowed only for external prerequisite material (e.g. graphql.org/learn
   on installation). No concluding summary section.

Headings are plain and descriptive ("Install", "Adding an object type",
"Hello world" — familiar names beat clever ones, ledger S10). Never restate
the heading as the section's first sentence.

## Banned constructions (ledger A1–A12, enforced at review)

- "It's not X. It's Y." in ALL forms, including "X isn't Y — it's Z",
  "not just X", "instead of X, Y" (A8). Contrast only when the misconception
  is real and the contrast is the content, at most once per page, no snap.
- Mic-drop endings ("That's the whole loop.") (A9).
- The selling register — any feel-something sentence (A10).
- Rhetorical parallelism unless the parallel is itself the content (A11).
- Em-dash chains / appositive pile-ups as the default sentence shape; use
  ordinary subordinate clauses (A12).
- Hollow aphorisms — quotable rhythm, no actionable content (A1).
- Inverted phrasings ("graphql is the peer dependency Pothos builds on");
  say it plainly (A2).
- Verb-list summaries that restate the page's headings (A3).
- Identical opening rhythm across sections or pages (A4).
- Inventory/cutesy openers ("takes an install, one setting, and ten lines")
  and stilted phrasing nobody would say aloud (S6).
- Over-advising ("so don't install any until you want the feature") (S7).
- Negation-first definitions; define by what things are and do (S2).
- Mechanism-dumping en route: one true sentence in passing, full mechanism
  only at the concept's home page (S5). Round 4 tightened this further:
  don't explain adjacent concepts AT ALL on a task page — name the thing and
  link (S15); don't cover edge-case/escape-hatch options on mainline pages
  (S16); don't enumerate API surface the page doesn't need (S18); state
  optionality explicitly where config could look required (S17).

## Code examples

- One world: the Middle-earth compendium with the canonical cast sheet in
  `.claude/docs-curriculum.md`. An entity name always means the same shape.
- Names must agree with type, cardinality, and theme (S8). Data values look
  real: ids look like ids ('1', '3'), not slugs (S9).
- Simple cases use the compact chained form:
  `builder.objectRef<T>('X').implement({...})` (S11).
- First code blocks are clean — teaching happens in prose, comments of more
  than one short line don't belong in them (S14). A one-line comment that
  states a constraint the code can't show is fine.
- Docs snippets are single-sourced from `website/playground-examples/`
  bundles via `<includeregions>` and `// #region` markers wherever a bundle
  exists; inline ` ```typescript playground ` fences only for self-contained
  teaching fragments, and runnable-looking fences should carry the playground
  affordance (U4).
- Never invent API names. Every builder/field-builder method in prose or code
  must be verified against the dossiers (`.claude/docs-dossier/`) or source.
  Known past inventions: `t.relayConnection`, `t.prismaObject`.

## Facts

- Every factual claim about Pothos behavior must be traceable to a dossier
  citation or to source read during writing. Plausible-but-unverified claims
  are review-blocking (ledger F1–F5 were all written confidently and were
  all wrong).
- All three definition styles (objectRef, class-backed, SchemaTypes-registered)
  are presented as equals; objectRef is the common default the docs use, not
  the "modern" one (S1).

## Review gates per page (the pipeline every page passes)

1. Draft against the page's dossier + this guide.
2. Adversarial fact-check: a separate agent tries to falsify every claim
   against source.
3. Slop screen: grep-level and read-level pass against the ban list above.
4. Orchestrator read.
5. Maintainer skims batches of 2–3 pages via the review tool; every comment
   becomes a ledger entry.
