---
"@pothos/plugin-drizzle": patch
---

Exclude the cursor-named row from `last`/`before` and `first`/`after` keyset queries by ANDing `ne` on number and bigint order columns. Date cursors are encoded at millisecond precision, so exclusive comparison against a microsecond `timestamptz` can re-include the cursor row.
