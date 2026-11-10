---
'@pothos/plugin-prisma': patch
---

Cursors and node IDs are now checked against their column's type. A value that does not match fails with `Invalid cursor.` or `Invalid ID.`, and the message no longer includes the input. This includes the errors from `parsePrismaCursor`.

IDs such as `1abc` or `1.9` no longer resolve to row 1, and a Boolean ID must be `true` or `false`. Only IDs and cursors in the format the plugin generates are accepted. Hand-built values such as a compound ID with non-string parts (`[84,1]` instead of `["84","1"]`), a DateTime ID of `2012-12-12`, or a BigInt ID of `0x10` used to load a row and are now rejected.
