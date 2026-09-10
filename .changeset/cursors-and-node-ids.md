---
'@pothos/core': minor
'@pothos/plugin-prisma': minor
'@pothos/plugin-drizzle': minor
---

Cursors and node ids round trip for every scalar type a key can hold, and compound cursors are
encoded with per-part type tags so every value in one keeps its type.

A compound cursor was a plain JSON array of the raw values in the prisma plugin. That throws
outright on a bigint, so a connection whose cursor is a `@@id` or `@@unique` containing a `BigInt`
column failed on every edge of every page; it wrote a `DateTime` out as an ISO string that came
back as a string, so the millisecond a row was created on was gone by the time the value reached
the query; and it wrote a `Bytes` column out as the JSON form of a buffer. Every part now carries
its own type tag. The drizzle plugin already tagged each part; what changes there is that a
compound cursor can hold bytes, a decimal and a JSON value there too.

A null cursor value now round trips in both plugins. The prisma plugin threw "Unsupported cursor
type object" while building the edge of a single value cursor, so a connection whose cursor names a
nullable column failed the whole page rather than only a request that paged from that row; `Json`
and `Bytes` values could not be written there either. The drizzle plugin wrote the string `null`,
which is not a value the cursor format can hold, so the cursor came back as "Invalid cursor" the
moment a client paged from that edge. Both now write a null as a tagged chunk and read it back as
`null`.

Cursors issued before this release still parse, in both plugins, to the same values they always
did. That legacy handling is deprecated and is removed in the next major. The `GPC:` and `DC:`
prefixes are unchanged, so only compound cursors are written differently; a single value cursor is
byte for byte what it was, apart from the null that neither plugin could write usefully. A single
value string cursor also no longer loses everything after the first newline it contains.

Other values that did not survive a round trip:

- A cursor value on a float, real or `Decimal` column, in both plugins. It was read back with
  `parseInt`, which truncates `1.75` to `1` and reads a large number's `1e+21` as `1`, so the page
  resumed from the wrong row.
- A prisma node id built from a `DateTime` field. It was serialized with `String(date)`, whose
  format carries no milliseconds, so `findUnique` looked for a row a fraction of a second before
  the real one and the node resolved as not found. Ids already handed out in the old format still
  parse. A drizzle node id built from a date column had the mirror problem on the way back: `new
  Date` was given the epoch milliseconds the serializer writes as a string, which is not a format
  it parses, so every such id resolved as an Invalid Date.
- A prisma node id built from a `Bytes` field. The base64 case was spelled `Byte`, which is not
  what the datamodel calls the type, so the value was serialized as `String(bytes)` (the bytes
  separated by commas) and parsed back as that string.
- A drizzle node id built by `builder.drizzleNode` with an `id.column` that is not the table's
  primary key. The id was parsed back into a record keyed by the database column name, while the
  serializer wrote, and the model loader reads, the typescript name; the loaded rows were then
  matched back to the ids they were loaded for by primary key, which such a record does not carry.
  Such a node now loads.
- A prisma compound node id (a `@@id` or `@@unique` used as `id.field`). It passed the field's
  `kind` (always `scalar`) where the type was wanted, so a `Json` or `Bytes` part was written as
  `String(value)` and could not be read back. Each part is now serialized by its scalar type, as
  the parser already read them.

Two paging fixes that go with them:

- A connection asked for `last: 0` pages backwards in both plugins, as any other `last` does. `0`
  was read as "no `last` given", so the query took rows forwards and `pageInfo` came back as
  though the request had been a forward page: `hasNextPage` true and `hasPreviousPage` false on a
  non-empty connection.
- A prisma compound cursor carrying the wrong number of values is rejected with a validation error
  naming both counts, rather than building a query with a missing key (or silently dropping an
  extra one) for prisma to reject. The drizzle plugin already checked this.

The tagging itself lives in `@pothos/core` (`encodeCursorChunk`, `encodeCursorTuple` and
`decodeCursorChunk`, alongside `encodeBase64Bytes` / `decodeBase64Bytes`) rather than being written
out once per plugin.
