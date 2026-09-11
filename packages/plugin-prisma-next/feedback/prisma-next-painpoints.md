# Prisma ORM 8 integration notes

Current target: 8.0.0-rc.9. Earlier observations are retained in git history.
Nested includes, N:M reads and rows-plus-count combinations are supported; the
old blanket multi-query/rejection claims are obsolete.

## Public refinement types

Upstream include-refinement helpers remain internal. Pothos reconstructs their
read surface from Collection and contract aggregate types. Recheck mutation
terminal omissions, reducers and type-state behavior on each upstream upgrade.

## To-one composition

RC9 rejects combine on to-one includes with ORM.INCLUDE_UNSUPPORTED. Compatible
consumers merge; independent incompatible filters fail before execution. A public
named/combined to-one projection would close this gap within complete planning.

## Existing ordering

orderBy appends, without a public reset. Connections own ordering and inspect
Collection state before adding it. A public state query or reset would remove
this compatibility debt. The helper does not inspect the database dialect.

## Programmatic contract emission

RC9's control emitter leaves internal package specifiers in emitted declarations.
Test generators map these to public exports. Serialized JSON also omits empty
structural defaults required by its runtime deserializer; fixture loaders restore
them. Both workarounds stay outside production plugin code.

## Family, identity and codecs

Mongo's contract/Collection differs from SQL; support needs a real separate
adapter with runtime tests. Duplicate bare model names across namespaces need a
qualified public identity. Native inheritance is distinct from Pothos variants.

Object-valued codecs such as Temporal require reversible application cursor/ID
codecs. Pothos intentionally does not infer them from a database dialect.
