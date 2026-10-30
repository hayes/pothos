# Release status

`@pothos/plugin-prisma-next` is `private: true` and has never been published to npm. It targets
exact `8.0.0-rc.22` Prisma ORM framework and SQL-family packages. Concrete drivers appear only in
tests and application examples, and production code has no database-dialect branches.

## Deliberate boundaries

- **MongoDB:** unsupported. Its Collection API has no refinement, `combine` or cursor support, so
  it needs a separate adapter.
- **Fallback loading:** needs application-supplied unpaginated model Collections and non-null
  primary or unique identities. Opaque object identities are rejected; scalar, Date, bytes and
  Decimal keys work. Without a provider, incompatible to-one refinements are rejected before SQL.
- **Conflicting prerequisites:** differing prerequisites on an object and its implemented interface
  are rejected before SQL; move the differing filters to fields. Separate variant fields can load
  different prerequisites in batches.
- **To-one selections:** function-form to-one selections are unsupported because Prisma throws
  `ORM.INCLUDE_UNSUPPORTED`. Use declarative selects or relation fields.
- **Namespaces and inheritance:** bare model names must be unique, and native inheritance isn't
  exposed. GraphQL variants are same-model views.
- **Preordered connections:** existing ordering must match the requested page's query direction,
  because Prisma has no public ordering reset. Unordered Collections work in both directions.
- **Drivers:** only SQLite and PostgreSQL are tested. Matching types are not runtime certification.
- **Inputs, descriptions and subscriptions:** there is no generated input companion, and no
  automatic mapping from contract comments or database change streams.

## Upstream compatibility seams

- `src/types.ts` reconstructs include-refinement types that Prisma doesn't export.
- `src/utils/collection-state.ts` reads the `@internal` Collection `state`, because `orderBy`
  appends and there is no public reset or pagination accessor.
- Test fixture generators map the `@internal/*` specifiers the programmatic emitter leaves in
  declarations. This stays outside production code.

Regenerate fixtures and rerun the integration tests whenever the pin changes.

## Verification

Run PostgreSQL on port 5456 with database `prisma_next` and user and password `prisma`, or set
`POTHOS_PRISMA_NEXT_DATABASE_URL`. CI provisions this in `node.js.yml` and `changesets.yml`.

```sh
pnpm --filter @pothos/plugin-prisma-next... build
pnpm --filter @pothos/plugin-prisma-next type
pnpm --filter @pothos/plugin-prisma-next test
pnpm exec biome check packages/plugin-prisma-next
```

Type checking covers the ordinary project and an isolated scope-auth project, which keeps that
plugin's global option augmentation from affecting unrelated tests. Generated contracts are checked
in alongside their regeneration scripts and source PSL.
