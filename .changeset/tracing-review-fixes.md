---
"@pothos/plugin-tracing": patch
---

Preserve explicit `tracing: null` field options instead of using the builder default, and handle
aliases such as `constructor` correctly when looking up parent spans.

The shared context cache at `Symbol.for('Pothos.tracing.spanCache')` now stores a `Map`. If multiple
versions of `@pothos/plugin-tracing` share a context, upgrade them together.
