# Non-database plugin examples

Coverage added against main `355570b71`. All 17 non-database plugin guides have executable examples:
14 use the browser playground and three use the local suite. Database recipes within otherwise
non-database guides retain their existing instructions. These examples cover reader tasks; they
do not turn every API signature, alternative configuration, server recipe, or invalid snippet into
a standalone browser application.

## Browser coverage

Each bundle owns its source, operations, and expected responses. Source regions supply the guide's
matching excerpts. The browser checker executes every operation and checks fresh Monaco diagnostics.
The 23 new programs (including three SubGraph variants) contain 56 operations.

| Guide | Example IDs | Observable behavior |
| --- | --- | --- |
| Dataloader | `plugin-dataloader` | Requested order despite unordered storage, missing keys, batching keys, repeated-key caching, key-returning fields. |
| Scope Auth | `plugin-scope-auth` | Same fields as signed-out user, reader, and editor; denied writes leave state unchanged; allowed writes persist. |
| Relay | `plugin-relay-nodes`, `plugin-relay-pagination` | Global identity and refetch, missing nodes, forward/backward/empty pages, invalid page sizes. |
| Validation | `plugin-validation` | Transformed valid input, structured validation issues, rejected mutations cause no writes. |
| Errors | `plugin-errors` | Successful union member, handled error member, unexpected GraphQL error. |
| Legacy Zod | `plugin-zod` | List and item validation, readable errors, unchanged state after rejection. Migration guidance remains. |
| With Input | `plugin-with-input` | Default/custom input argument names, optional input, required-input rejection. |
| Simple Objects | `plugin-simple-objects` | Existing Person/Pet fields, computed field, extending generated types. |
| Mocks | `plugin-mocks` | Mock selected resolvers while retaining an unmocked resolver. |
| Add GraphQL | `plugin-add-graphql`, `plugin-add-graphql-types`, `plugin-add-graphql-ref`, `plugin-add-graphql-kinds` | Imported schema and selected types, customized object ref, interface/union/enum/input behavior. |
| Directives | `plugin-directives` | Inspect directive metadata on the type and field; no claim that metadata itself implements execution. |
| Complexity | `plugin-complexity` | Allowed query, complexity estimate, cost/depth/breadth rejection, resolver counter proving rejection prevents execution. |
| SubGraph | `plugin-sub-graph` and internal/combined/shared variants | Public/internal field visibility, combined/default memberships, rejected excluded fields. |
| Tracing | `plugin-tracing`, `plugin-tracing-options`, `plugin-tracing-lifecycle` | Duration and custom-label console output, synchronous/asynchronous success/failure, disabled tracing, preserved resolver errors. |

Browser checks also cover the authored docs actions and variants at desktop/mobile sizes, suggested
edits, operation inputs, reset, and sharing. Tracing's dedicated check asserts actual console output
and a source edit that enables tracing, without comparing volatile durations to golden values.

## Local coverage

Run `pnpm --dir website check:local` from the repository root after dependency installation.
It builds current workspace packages, creates an isolated locked GraphQL 16 installation, typechecks
each local application, and executes its assertions. It runs in the Documentation playground CI job.
See [local setup](../local-examples/README.md).

| Guide | Sources | Checked behavior and boundary |
| --- | --- | --- |
| Smart subscriptions | `local-examples/smart-subscriptions` | Two actual subscription iterators receive initial values and updates; closing one preserves the other; final cleanup removes all listeners. The browser does not consume subscription iterators. |
| Grafast | `local-examples/grafast` | Real `grafast()` execution, changed arithmetic arguments, interface/union type selection, missing entity. Grafast 1.0 requires GraphQL 16 and its own executor. |
| Federation | `local-examples/federation` | Four operations across users/inventory/reviews schemas: existing/missing representations, required shipping inputs, provided usernames. Apollo subgraph dependencies require Node. These checks execute individual subgraphs, not router composition or cross-service requests. |

Tracing provider SDKs, HTTP/server setup, subscription transport setup, database pagination, and
other environment-dependent recipes remain local application instructions. No browser action claims
to run them, and no external provider ingestion is asserted by this batch.

## Preservation and review

The docs explain APIs and code without requiring the playground. Operation selection, suggested
edits, and run/reset instructions live in the playground guide descriptions. Fixture instrumentation
stays in executable examples; local server and CLI workflows remain in the docs.

No substantive workflow was retired. Independent reviews compared the resulting pages with the
original base and accounted for replaced source blocks:

- Dataloader retains its application loader recipe; Relay's node and ordinary-object connection
  examples use matching source regions. Scope Auth retains its original scope/grant/cache reference
  workflows and links its basic field to an executable example. Loader/Relay alternative implementations, subscription cache guidance, and database
  recipes remain.
- Simple Objects' original complete example and extension moved to executable source. Validation,
  Errors, Zod, With Input, and Mocks add focused examples while preserving their option catalogs,
  migration notes, and broader configurations.
- Add GraphQL and SubGraph examples moved to corresponding executable sources and variants.
  Directive representation alternatives remain. Complexity retains both enforcement and standalone
  estimation; its existing utility example now uses the API's actual `ctx` option. Federation moves
  matching entity examples into the local suite while retaining setup, alternatives, and gateway
  guidance.
- Tracing's first schema and custom options moved to source-backed examples; all provider recipes,
  setup imports, error semantics, and lifecycle caveats remain. Grafast retains resolver and plain
  union alternatives alongside its executable planForType schema. Smart subscriptions retains
  iterator-source, object-refetch, field-refetch, filtering, invalidation, and debounce caveats.
  The executable event sample explicitly disables debounce for deterministic checks.
- Every changed plugin README expands the same TypeScript source excerpts as its guide. Playground
  actions stay on the website; package READMEs omit playground links. All TypeScript excerpts are
  compared for exact source parity. Review caught and corrected stripped imports during README
  synchronization, a relative package link, and suggested edits whose messages no longer matched
  their validation limits.

Shared implementation changes are limited to Tracing/Zod browser module and type availability,
multiline/side-effect plugin import detection, separate local TypeScript programs, and execution
checks. A focused import-detection regression test failed before the fix and passed afterward.
