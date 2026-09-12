---
"@pothos/plugin-tracing": patch
---

Preserve an explicit `tracing: null` field option instead of falling back to the builder default
Use a Map for the span cache so a field aliased `constructor` no longer produces a fabricated parent span
