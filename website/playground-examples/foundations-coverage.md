# Foundations example coverage

Base: `1beb40708` (the reviewed playground pilot on main). This pass covers the overview and six foundational guide pages, preserving the renewed explanations while replacing runnable fences with excerpts from complete, checked examples.

## Page and example mapping

| Page | Executable example | Preserved coverage |
| --- | --- | --- |
| Overview | `foundations-overview` | Gina's backing height in meters, computed feet, inferred resolver types, standard `GraphQLSchema`, core peer dependency and all plugin cards. One file and one query. |
| Getting started | `foundations-getting-started` | Optional `name`, nullish fallback, the same schema/query/response, installation, strict NodeNext config, Yoga server, separate type checking, execution and Ctrl+C cleanup. One file and one query. |
| Fields: scalars | `foundations-field-scalars` | Generic `field`, scalar convenience methods and all five scalar list helpers. |
| Fields: other types, lists, exposing, args, added fields | `foundations-field-types` | SchemaTypes object lookup, enum ref, object/scalar lists, exposed properties, required argument with unknown-name error, separately added root/object fields. Class/enum reference and interface applicability explanations remain. |
| Fields: nullability and nested lists | `foundations-field-nullability`, `foundations-field-nested-lists` | Non-null fields/lists, nullable list items, default-nullability link, nested list refs and a nullable inner list. |
| Arguments | `foundations-arguments` | Generic and convenience arg methods, required/default/null semantics, scalar lists, nullable items, enum unit arguments on object fields, nested lists, the complete existing query and result. |
| Input objects | `foundations-inputs`, `foundations-inputs-named` | Separate output/input types, field and argument requiredness, in-memory create mutation, recursive input ref/explicit shape, each descendant's own data, optional/nullable friends list, and the complete SchemaTypes alternative. |
| Context | `foundations-context`, `foundations-context-transports` | Typed current user, nullable signed-out result, request context creation, Yoga authentication hook, `initContextCache` identity/lifetime rules, and the HTTP/WebSocket discriminated union. |
| Queries, mutations and subscriptions | `foundations-root-operations` plus `variant-separate` | Root type definition once; individual/plural field additions; stateful creation and subsequent read; complete alternative query-field registration. Subscription/provider/cleanup and event-type inference guidance remain. |

The page examples keep their existing data and behavior. To make the Fields snippets form coherent schemas, later `queryType` declarations become `queryFields`; the prose explains that the root is already defined. The separately added root field becomes `newestGiraffe`, preserving its James result without overwriting the initial Gina field. The enum resolver preserves its literal type with `as const`. Unused resolver parameters are omitted or prefixed `_`. Query operations are named for the repository's GraphQL lint rule. Input-by-name excerpts now show the entire `input:` property rather than an unattached expression.

## Browser versus server execution

Three TypeScript fences intentionally remain local server examples: Getting started's Yoga server, Context's Yoga/auth context factory, and the subscription schema with an application-supplied event provider. Shell commands, configuration, expected JSON and live subscription operations remain documentation rather than playground actions. Their existing installation, ownership, transport and cleanup guidance is retained.

The context transport example executes the WebSocket-shaped JSON branch. Its guide and playground instructions explicitly distinguish that fixture from an actual connection and explain why the HTTP branch needs a real server-created `Request`. Context's primary example checks both signed-in and signed-out data. No runtime, provider or HTTP transport was added to the playground.

## Acceptance

Every new operation has `expected.json` coverage, including the nullable-field error and ordered mutation/read scenarios. The bundle checker checks these responses in the production browser and checks both TypeScript worker diagnostics and actual editor markers. Source includes also select matching GraphQL operations through the existing snippet matching behavior.

Validation records are reported in the PR alongside the production browser run, source checks, independent review and the selected reader edits. The source-derived overview and introduction continue passing the maintained docs assertions, including omitted/null/empty names, backing-property exclusion and printed SDL round trip.

## Docs entry point update

`/docs` now contains Getting started, moved from `/docs/guide` with all installation, schema,
server, query, response, and continuation steps preserved. `/docs/guide` and its Markdown exports
redirect to the new location.

The previous overview's data-mapping example remains at `foundations-overview`, linked from Objects.
Its backing-property exclusion, conversion, resolver inference, and SDL behavior remain checked.
The no-resolver-codegen explanation is retained in Getting started; standard schema output and the
required GraphQL dependency are covered by its schema and installation steps. Objects covers the
backing-data explanation. All 18 removed plugin cards remain in the plugin directory. The duplicate
logo and introductory copy are removed because the landing page now introduces Pothos.
