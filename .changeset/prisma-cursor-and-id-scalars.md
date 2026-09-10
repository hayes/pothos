---
'@pothos/plugin-prisma': patch
---

Cursors and node ids round trip for scalar types other than `Int` and `String`.

- A cursor value on a `Float` or `Decimal` column round trips. It was read back with `parseInt`,
  which truncates `1.75` to `1` and reads a large number's `1e+21` as `1`, so the page resumed
  from the wrong row. The drizzle plugin already read it with `Number`.
- A node id built from a `DateTime` field parses back to that instant. It was serialized with
  `String(date)`, whose format carries no milliseconds, so `findUnique` looked for a row a
  fraction of a second before the real one and the node resolved as not found. Ids already handed
  out in the old format still parse.
- A node id built from a `Bytes` field round trips. The base64 case was spelled `Byte`, which is
  not what the datamodel calls the type, so the value was serialized as `String(bytes)` (the
  bytes separated by commas) and parsed back as that string.
- A compound node id (a `@@id` or `@@unique` used as `id.field`) serializes each part by its
  scalar type, as the parser already read them. It passed the field's `kind` (always `scalar`)
  where the type was wanted, so a `Json` or `Bytes` part was written as `String(value)` and could
  not be read back.
