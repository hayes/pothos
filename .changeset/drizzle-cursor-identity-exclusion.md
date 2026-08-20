---
"@pothos/plugin-drizzle": patch
---

Exclude the cursor-named row from `last`/`before` and `first`/`after` keyset queries by ANDing `ne` on a single-column number or bigint primary key that is part of the order. Date cursors are encoded at millisecond precision, so exclusive comparison against a microsecond `timestamptz` can re-include the cursor row. Non-PK numeric order columns are left alone so a compound keyset prefix (for example `category_id`) is not dropped.
