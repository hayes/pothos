# Release status

`@pothos/plugin-prisma-next` is `private: true` and has never been published to npm. It targets
exact `8.0.0-rc.22` Prisma ORM framework and SQL-family packages. Concrete drivers appear only in
tests and application examples, and production code has no database-dialect branches.

## Deliberate boundaries

- **MongoDB:** rejected at schema build. On RC22 against MongoDB 8, Collections have no `combine`,
  `cursor` or aggregates, and `include('rel', refine)` and `where(callback)` silently return
  unfiltered rows.
- **MySQL (preview):** reads run in CI against MySQL 8.4. Contracts declare no aggregates, so count
  options are compile errors with a clear runtime error for untyped callers, and ORM writes need the
  `returning` capability.
- **Serverless Postgres:** tested against a local server. Workers and Hyperdrive are not run. Other
  drivers carry no validation claim.
- **Fallback loading:** needs application-supplied unpaginated model Collections and non-null
  primary or unique identities. Object identities use column codecs through `prismaNext.context`,
  or a string `toJSON()`. Without a provider, incompatible to-one refinements and conflicting
  object and interface prerequisites are rejected before SQL.
- **To-one selections:** function-form to-one selections are unsupported because Prisma throws
  `ORM.INCLUDE_UNSUPPORTED`. Use declarative selects or relation fields.
- **Inheritance:** variant returns need `orm.Base.variant(value)`. Relations a variant declares
  load on narrowed collections; beneath the base interface they need a Collection provider.
  Relations targeting a variant model filter single-table variants by discriminator, but can't
  include relations the variant inherits without a provider. `prismaNode` on a variant, qualified
  and cross-namespace hierarchies, and custom variant type names are tested. `t.relation` and
  `t.relatedConnection` typed as a variant need a cast for the `type` option.
- **Preordered connections:** existing ordering must match the requested page's query direction,
  because Prisma has no public ordering reset. Use the `orderBy` option or an unordered Collection
  to support both directions. Bytes columns can't be cursors, because their accessors have no order.
- **Cursors from clients:** type-mismatched values in a forged cursor aren't rejected. They only
  affect the forger's own page.
- **Inputs, descriptions and subscriptions:** there is no generated input companion, and no
  automatic mapping from contract comments or database change streams.

## Upstream compatibility seams

- `src/types.ts` reconstructs include-refinement types that Prisma doesn't export.
- `src/utils/collection-state.ts` reads the `@internal` Collection `state` to validate pagination
  and preordered prefixes, because `orderBy` appends and there is no public reset or accessor.
- `src/utils/contract.ts` reads the `@internal` Collection `state.variantValue` to require
  `orm.Base.variant(value)` for fields returning a variant model, because Prisma has no public
  accessor for a Collection's variant.
- Test fixture generators map the `@internal/*` specifiers the programmatic emitter leaves in
  declarations. This stays outside production code.

Regenerate fixtures and rerun the integration tests whenever the pin changes.

## Verification

Run PostgreSQL on port 5456 with database `prisma_next` and user and password `prisma`, or set
`POTHOS_PRISMA_NEXT_DATABASE_URL`. CI provisions this in `node.js.yml` and `changesets.yml`. Set
`POTHOS_PRISMA_NEXT_MYSQL_URL` to run the MySQL tests; `node.js.yml` provisions MySQL 8.4.

```sh
pnpm --filter @pothos/plugin-prisma-next... build
pnpm --filter @pothos/plugin-prisma-next type
pnpm --filter @pothos/plugin-prisma-next test
pnpm exec biome check packages/plugin-prisma-next
```

Type checking covers the ordinary project and an isolated scope-auth project, which keeps that
plugin's global option augmentation from affecting unrelated tests. Generated contracts are checked
in alongside their regeneration scripts and source PSL.
