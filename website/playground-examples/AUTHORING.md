# Authoring docs and playground examples

Read this before adding playground links, writing a guide, changing an example, or choosing between code tabs, variants, steps, and multiple files. These tools are available by choice: use the combination that helps the reader perform the guide's task. Objects and Using the playground provide reviewed patterns for variants and steps.

## Author workflow

1. Read the current guide, its relevant package source/tests, and [documentation review requirements](../../CONTRIBUTING.md#reviewing-documentation-changes). State what the reader will run, change, and observe. Inventory substantive material being replaced; preserve supported alternatives and caveats, including refs, classes and SchemaTypes where applicable.
2. Choose a complete example and its owning docs route. Reuse one example across related sections when each link demonstrates the section's actual behavior. Keep complete source visible and copyable. Use plain data and refs naturally; classes remain appropriate when the application already uses them. Do not retheme a renewed guide just to match an older example collection.
3. Author executable source, operation fixtures, expected results and focused source regions together. Choose the UI tools below deliberately. A page need not use every tool; an example does not become better merely by gaining tabs or steps.
4. Build generated artifacts, type-check the exact sources, then execute the examples in the browser. Click the rendered docs action for every changed tab/variant and verify the loaded source, operation, inputs and result. Inspect desktop/mobile reading and interaction, compiled Markdown, guide backlink, sharing and reset. Record actual checks and limits.
5. Obtain independent content/correctness and preservation review before fanout or publication. Compare against the original pre-rewrite page as well as the immediate parent when changes are stacked. Every removed workflow needs retained/replacement coverage or a source-backed retirement reason.

Completion means the reader can follow the explanation, run the corresponding code, make the suggested edit, and observe the promised effect. A compiling schema, valid query, working URL, or shorter page alone does not establish that.

Write docs for readers who will read and copy the code without opening the playground. Keep API explanations, relevant outcomes, and complete local workflows in the docs. Use `metadata.description` to introduce the example and explain what the reader can observe. Keep it concise and understandable before opening any operation. Put operation-specific suggestions in comments beside the relevant GraphQL operation, or in the current step’s `description` when they belong to that step. Package READMEs contain code snippets and API explanations. Omit links and references to browser or local example projects, repository test commands, and instructions for running or editing those projects.

Start introductory examples with one source file and one useful query. Add variables, context, helper files, steps, or variants when they teach the page's concept, not to demonstrate the toolkit. Keep trivial resolvers inline. Choose `defaultActiveFile` so a step opens on the code the reader needs; verify the initial file in the actual playground. Follow the full step sequence, including moving backward and resetting, rather than checking only isolated step URLs.

## Files and metadata

Author in `website/playground-examples/<id>/`; run scripts with `website` as the working directory. Do not hand-edit generated public JSON or `components/playground/examples/examples-index.generated.ts`.

```text
objects/
  metadata.json
  schema.ts
  query.graphql
  expected.json
```

```json
{
  "id": "objects",
  "title": "Object types",
  "description": "Run the query, change the birthday, then run again to see birthYear change.",
  "category": "core",
  "order": 10,
  "relatedDocs": ["/docs/guide/objects"],
  "defaultActiveFile": "schema.ts"
}
```

Keep the ID equal to the directory name. `schema.ts` exports a named `schema`, built with `builder.toSchema()`. Use actual current package APIs. `category` accepts `core`, `plugins`, `examples`, or `patterns`; optional `subcategory`, `tags`, `difficulty` and `order` support catalog organization. `difficulty` accepts `beginner`, `intermediate`, or `advanced`. Metadata is not a curriculum engine: `prerequisites` is carried in the bundle but does not load dependencies or enforce completion.

The guide area displays the example description, or the current step description, as **plain text**, with the first `relatedDocs` link and a reset action. Write a short contextual introduction, not a checklist of operation filenames. When a step needs several short instructions, newlines (`\n` in JSON) render as list items. A single-line description stays a paragraph. Markdown, rich guide blocks, and additional related links are not rendered there.

## Excerpts, literal fences and playground actions

Prefer source-derived excerpts when a complete example owns the code. Mark contiguous regions in its source:

```ts
// #region giraffe-ref
const Giraffe = builder.objectRef<{ name: string }>('Giraffe');
// #endregion giraffe-ref
```

In MDX, paths with `cwd` are relative to `website`:

```mdx
<include cwd lang="typescript" meta='playground example="objects"'>playground-examples/objects/schema.ts#giraffe-ref</include>
```

Omit `#region-name` to include a whole file. For several regions **from one file**, use the separate `includeregions` element:

```mdx
<includeregions cwd lang="typescript" meta='playground example="objects"'>playground-examples/objects/schema.ts#model,giraffe-ref,giraffe-fields</includeregions>
```

Regions are joined in the listed order with a blank line, without an automatic omission marker. Supply real region names and keep the resulting excerpt understandable. Do not pass comma-separated names to `include`. Region marker comments are stripped from published playground source. The MDX pipeline registers source dependencies for rebuilds; missing referenced regions fail compilation.

A literal TypeScript fence can instead use `playground` alone when its exact body is a complete runnable schema, or `playground example="objects"` when the body is a focused excerpt of that bundle. The latter loads the **bundle**, not the fence body. `query="{ giraffe { name } }"` overrides the initial query. Fence attributes only support the implemented `playground`, `example`, `query` and Fumadocs `tab` mechanisms; invented `operation=`, `context=`, `file=` or `region=` attributes do not select runtime state. Query attributes use simple quote matching: prefer a named operation file and direct link for complex quoted queries.

Do not put run actions on installation commands, generated SDL, intentionally invalid examples or server-only snippets. A partial schema needs a complete example; server/database setup needs real local-run instructions.

## Code tabs and matching definition-style variants

**Refs/classes/SchemaTypes code tabs are available.** Consecutive fences or includes carrying `tab="Label"` merge into one Fumadocs code block. Each tab must name the matching executable bundle:

```mdx
<include cwd lang="typescript" meta='playground example="objects" tab="Object refs"'>playground-examples/objects/schema.ts#object-definition</include>

<include cwd lang="typescript" meta='playground example="objects-variant-classes" tab="Classes"'>playground-examples/objects/variant-classes/schema.ts#object-definition</include>

<include cwd lang="typescript" meta='playground example="objects-variant-builder-types" tab="SchemaTypes"'>playground-examples/objects/variant-builder-types/schema.ts#object-definition</include>
```

These region names illustrate the convention; use names actually declared in the files. Keep tabs consecutive, without prose between them. The same `tab` syntax works on literal fences and `includeregions`. The custom multi-region transform runs before Fumadocs tab merging.

Declare the alternatives in root metadata:

```json
{
  "variants": [
    { "id": "refs", "title": "Object refs", "default": true },
    { "id": "classes", "title": "Classes" },
    { "id": "builder-types", "title": "SchemaTypes" }
  ]
}
```

The default uses root `schema.ts` and ID `objects`; it is **not** `objects-variant-refs`. Other variants live in `variant-classes/` and `variant-builder-types/`, each with complete source and `expected.json`. A variant with no GraphQL files inherits the base operation list. It does not inherit arbitrary source files: imports must resolve within its own bundle. Exactly one variant is default, and declared directories must match. Variants should produce the same relevant schema/behavior and run the same acceptance operation.

Tabs select the docs excerpt and its launch target. There is no general standalone variant switcher implemented by declaring this metadata; variants are hidden as separate catalog entries. Verify every selected tab's action in the browser, not just the initially visible refs tab.

## Multi-step examples

Use steps when executing intermediate stages helps explain a progression. Each stage is a complete fresh schema; changes are not incrementally applied to the previous stage.

```text
a-guide/
  metadata.json
  step-1/schema.ts
  step-1/query.graphql
  step-1/expected.json
  step-2/schema.ts
  step-2/query.graphql
  step-2/expected.json
```

```json
{
  "steps": [
    { "id": "step-1", "title": "Define a type", "description": "Run the query to inspect the fields.", "order": 1 },
    { "id": "step-2", "title": "Add a resolver", "description": "Change the resolver and compare the result.", "order": 2, "defaultActiveFile": "schema.ts" }
  ]
}
```

Publish IDs are `a-guide-step-1`, `a-guide-step-2`; `a-guide` loads the first built step. The stepper supplies titles, previous/next controls and descriptions; the guide area also displays the current description. Keep metadata array order and numbered directory order aligned (use a short sequence; directory ordering is lexical). Steps **cannot** coexist with variants in one family; the builder rejects the matrix. Do not promise saved edits when changing steps: loading a step replaces files and operations.

## Multiple files, operations, inputs and expected results

The pilot adds recursive authored-file collection: nested `.ts`/`.d.ts`, `.json` and `.sql` files belong to a bundle; imports may use relative paths. `defaultActiveFile` names the file, not its numeric index, and may be set at family or step level. A missing match falls back to the initial file. `schema.ts` is prioritized; generated filenames `contract.json`, `contract.d.ts`, `seed.sql` are grouped as generated. Basenames starting `_` are hidden in the file picker but still bundled; do not hide code essential to the lesson. `README.md`, `schema.prisma`, `expected.json` and `.test.ts` files are excluded from editor source. JSON/SQL support does not itself provide a database or migration runtime.

Each `.graphql` file creates an operation tab, titled from its filename, in sorted filename order. Use `01-create.graphql`, `02-read.graphql` when order matters. A document can contain several named operations; execution chooses according to the editor caret. For predictable acceptance, prefer one named operation per file.

The pilot's authored input convention is:

```text
context.json                  # default context for all operation tabs
query.graphql
query.variables.json          # variables for query.graphql
query.context.json            # context override for query.graphql
```

Sidecars contain objects, not metadata declarations. A query-specific context replaces the default; do not assume a deep merge. The UI supports editable Variables and Context per operation, and loaded context is preserved by the example loader. `context.js` is a legacy default-context form; use JSON for new data fixtures. Metadata-level `queries`, `variables` or provider declarations are not an alternate authoring interface. Context input does not instantiate a database client or import a function from a source file. The current runner parses object literals; use JSON for fixtures and supply any real providers through an explicitly supported runtime rather than assuming they exist.

`expected.json` maps exact GraphQL filenames to expected GraphQL responses:

```json
{
  "query.graphql": {
    "data": { "giraffe": { "name": "James", "birthYear": 2012, "height": 5.2 } }
  }
}
```

The pilot browser checker executes scenarios in sorted filename order, so mutations can precede assertions of their stored effects. Each variant/step carries its own expectations, including when operations are inherited. Include intentional error responses when they are the lesson; avoid volatile timings. UI actions, console output, batching counts, subscription cleanup, or side effects not represented in response data need additional meaningful behavioral checks. `expected.json` alone does not assert them.

The recursive collector, operation sidecars, `type:examples` and `check:playground` are pilot additions. Before delegation, verify that they are present in the integration branch and run the checks below; do not rely on older checkout scripts or the historical README's claims.

## Opening, sharing and exploring

| Reader action | Implemented behavior |
| --- | --- |
| Docs playground button | Opens a lazy full-screen iframe overlay, preserves the docs page, and loads the selected bundle or complete inline schema. |
| Standalone link | `/playground?example=objects` loads a registered example. |
| Selected step | `/playground?example=a-guide&step=2` or the explicit `a-guide-step-2` example ID. |
| Selected operation | `/playground?example=a-guide&op=2` selects the second operation (1-based). Code fences and include metadata also accept `op="2"`; the action opens that operation with its variables and context. Use `op` or `query`, not both. |
| Query override | `query` URL parameter is base64-encoded by the overlay; use generated links rather than hand-escaping complex GraphQL. |
| Embed | `embed=1` hides standalone-only navigation/picker affordances. The docs overlay sets it automatically. |
| Share | The UI encodes edited files and operation state in a URL hash. Share through the UI; avoid hand-authoring compressed state. Shared code requires explicit trust before execution. |
| Reset example | Reloads the example without edited hash state. Verify fresh mutation data and current step behavior for the authored workflow. |
| Schema exploration | Source files, generated SDL, schema explorer, query editor and response view are available; no separate authored SDL file is needed to expose the built schema. |
| Console | Captures build/resolver console output and surfaced GraphQL errors. Use it for meaningful observations, not as a substitute for assertions. |

Extension response panels have runtime hooks (`extensions.playgroundPanels` and registered panel helpers), but there is no metadata switch that turns on SQL capture or tracing. Such integrations need actual runtime wiring and separate validation. No automatic external HTTP server, authentication-header interpretation, provider ingestion, SQL service, subscription event source, or package generator is supplied by adding source files. Headers UI does not make local GraphQL execution an HTTP request. The runner uses `graphql()` for queries/mutations; it does not implement live `subscribe()` execution.

Schema code executes with browser capabilities; a TypeScript compiler worker is not an isolation boundary for resolver code. Shared-code trust, browser-only dependency compatibility, runtime responsiveness and network requirements remain real constraints. Never describe illustrative Node/Yoga files as a running browser server.

## Validation commands and review evidence

From the repository root:

```sh
pnpm --dir website codegen
pnpm --dir website check-playground-refs
pnpm --dir website type:examples
pnpm --dir website check:playground http://localhost:4321
pnpm --dir website check:examples
pnpm --dir website build-ci
```

`check:playground` requires a running website at the supplied URL. Check `website/package.json` for current commands. `test:examples` builds bundles, requires an expectation for every operation, and type-checks source. `test:browser` starts the production website, checks editor TypeScript diagnostics and every operation, exercises step-file removal, and checks rendered links, then stops its server; the Documentation playground CI workflow runs both. A reference check confirms bundle destinations, while MDX compilation checks source includes. Neither alone proves correct tab targets, useful initial queries, contextual inputs, matching source excerpts or mobile usability.

Record the owning page, changed region/variant/step, actual operation and inputs, expected outcome, browser result, suggested reader edit, preservation mapping and remaining limits. If a capability is missing, report the gap and keep the example honest; do not invent metadata, silently add runtime scope, or attach a button that loads an unrelated demo.

## Implementation references

- [Bundle builder](../scripts/build-playground-examples.ts): authoritative file/metadata ingestion and generated outputs.
- [MDX configuration](../source.config.ts) and [multi-region transform](../lib/remark-multi-region.ts): code attributes, region inclusion and tab ordering.
- [Example loader](../hooks/playground/useExampleLoader.ts): actual operation inputs and step state.
- [URL bootstrap](../hooks/playground/useUrlBootstrap.ts) and [URL state](../lib/playground/url-state.ts): supported destinations and sharing.
- [Query runner](../hooks/playground/useQueryRunner.ts): actual execution/context behavior.
- [Playground page](../app/playground/page.tsx): current guide/step/reset presentation.
