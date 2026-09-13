---
"@pothos/plugin-tracing": patch
---

Preserve an explicit `tracing: null` field option instead of falling back to the builder default
Use a Map for the span cache so a field aliased `constructor` no longer produces a fabricated parent span. The cache lives on the context under the cross-realm registry key `Symbol.for('Pothos.tracing.spanCache')`, so its value changes shape from a plain object to a `Map`. This only matters if two different versions of `@pothos/plugin-tracing` share one context in the same process, which the `peerDependency` on every `tracing-*` package normally prevents; if you have a duplicated install, upgrade all copies together.
