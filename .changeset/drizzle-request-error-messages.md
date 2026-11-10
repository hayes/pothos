---
'@pothos/plugin-drizzle': patch
---

Hide the details of schema mistakes that are only found during a request. Clients now see `Unexpected error.`. The original message, such as `Relation followers does not exist on users`, is on the thrown error's `cause` (`originalError.cause` on the GraphQL error). This applies to:

- A field or connection `select` with a relation the table does not have
- An `orderBy` that names neither a column nor an extra
- A row returned without its primary key columns
- A table without a primary key where one is needed
- A parent row that no longer exists

Mistakes in a type definition fail when the type is defined:

- An unknown relation in the type-level `select` of a `drizzleObject` or `drizzleNode` already failed when the type was defined. It is now a `PothosSchemaError` that names the type.
- The same mistake in a `drizzleInterface` now fails when the interface is defined. Such a schema used to build, and only fields returning the interface failed. Fix the `select` before upgrading.
- A `drizzleNode` with a single boolean, bytes, geometry or array ID column now fails when it is defined. These columns can't be written as an ID, so it used to fail on every request.
