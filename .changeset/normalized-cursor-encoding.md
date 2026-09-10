---
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
'@pothos/core': minor
---

Compound cursors are now encoded with per-part type tags, so every value in one keeps its type.

A compound cursor used to be a plain JSON array of the raw values in the prisma plugin. That
throws outright on a bigint, so a connection whose cursor is a `@@id` or `@@unique` containing a
`BigInt` column failed on every edge of every page; and it wrote a `DateTime` out as an ISO string
that came back as a string, so the millisecond a row was created on was gone by the time the value
reached the query. Both now work, along with `Bytes`, `Decimal` and `Json` parts, which could not
be written at all. The drizzle plugin already tagged each part; what changes there is that a
compound cursor can now hold bytes, a decimal and a JSON value too.

A null cursor value now round trips in both plugins. The prisma plugin threw "Unsupported cursor
type object" while building the edge, so a connection whose cursor names a `@@unique` containing a
nullable column failed the whole page rather than only a request that paged from that row. The
drizzle plugin wrote the string `null`, which is not a value the cursor format can hold, so the
cursor came back as "Invalid cursor" the moment a client paged from that edge. Both now write it
as a tagged chunk and read it back as `null`.

Cursors issued before this release still parse, in both plugins, to the same values they always
did. That legacy handling is deprecated and is removed in the next major. The `GPC:` and `DC:`
prefixes are unchanged, so only compound cursors are written differently; a single value cursor is
byte for byte what it was, apart from the null that neither plugin could write usefully. A single
value string cursor also no longer loses everything after the first newline it contains.

The tagging itself now lives in `@pothos/core` (`encodeCursorChunk`, `encodeCursorTuple` and
`decodeCursorChunk`, alongside `encodeBase64Bytes`/`decodeBase64Bytes`) rather than being written
out once per plugin. It had been written twice and had already drifted: a truncation bug where a
float cursor was read back with `parseInt` was fixed in the drizzle plugin and left standing in the
prisma one until a later pass caught it.
