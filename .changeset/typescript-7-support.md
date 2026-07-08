---
'@pothos/plugin-prisma': minor
'@pothos/plugin-relay': patch
---

Support TypeScript 7.

The prisma generator (`prisma-pothos-types`) previously built its output with the TypeScript
compiler API (`ts.factory` + printer), which no longer exists in TypeScript 7 — the Go-based
compiler ships no in-process JS API. The generator now emits the same output (byte-identical)
via string templates, so it no longer imports `typescript` at runtime and works regardless of
which TypeScript version (or none) is installed. The `typescript` peer dependency of
`@pothos/plugin-prisma` has been removed accordingly.

`@pothos/plugin-relay` contains two internal fixes for type-checker differences between
TypeScript 6 and 7 (explicit type arguments where 7 picks a different inference candidate, and a
resolver wrapper that is checked against the declared resolver type). No public types changed;
the plugin now type-checks cleanly under both majors.
