# Contributing to the Prisma Next plugin

Notes for changing this package. The repository's `CONTRIBUTING.md` covers the rest.

## Runtime checks

Pothos trusts its developers and its types. Don't check again at runtime what the types already
enforce, such as model keys, relation names, option shapes or which plugins are loaded, and don't
write tests that pass ill-typed values with `as never` to reach such a check. A stub that matches
the types must work.

Check at runtime only:

- input from API clients, such as cursors, node IDs and arguments;
- rules the types can't express or that depend on runtime values, such as a reload of a model
  without a key, the values callbacks return, or a client that doesn't match the contract;
- a mistake that would otherwise return wrong data for well-typed code. Report that as a hole in
  the types as well.

## Errors

Pick the error class by who has to act on it:

- **The developer, while the schema is built:** `PothosSchemaError`.
- **The API client, for bad input:** `PothosValidationError`, with a message that is safe to show:
  no model or column names, and nothing the client sent. A bad cursor is just `Invalid cursor.`.
- **The developer, during a request:** a plain `Error`, whose message keeps the detail for logs
  but leaves out row values.

`PothosSchemaError` and `PothosValidationError` extend `GraphQLError`, which servers that mask
errors, such as GraphQL Yoga, pass through to the client. A plain `Error` is masked. Code shared by
the build and a request, such as `variantForRelationType` and `sharedVariantRelationError`, takes
the error to throw, so the build path keeps `PothosSchemaError`.

## Running the tests

Most tests use SQLite files and need nothing else. `tests/postgres.test.ts`,
`tests/postgres-junction.test.ts` and `tests/namespaces.test.ts` need PostgreSQL 15 or later at
`postgresql://prisma:prisma@localhost:5456/prisma_next`, or at `POTHOS_PRISMA_NEXT_DATABASE_URL`,
and fail without it. They create and drop their own tables and schemas. `tests/mysql.test.ts` runs
only when `POTHOS_PRISMA_NEXT_MYSQL_URL` is set, and CI doesn't set it.

The repository's `docker-compose.yml` starts both databases. From the repository root:

```sh
docker compose up -d prisma-next-postgres prisma-next-mysql
```

Then, from this package's directory, run the suite without and with MySQL:

```sh
pnpm vitest --run
POTHOS_PRISMA_NEXT_MYSQL_URL=mysql://root:prisma@localhost:5478/prisma_next pnpm vitest --run
```

The MySQL server takes a few seconds to accept connections after it starts.

## Type checks

`pnpm type` checks the package and its type tests (`tests/types/*.test-d.ts`) with the
repository's TypeScript. The plugin's types also have to work on older compilers, so run
`pnpm type:compat` after changing anything in `src/types/` or the type tests. It checks the same
projects with TypeScript 5.9 and 6.0, whose inference and error messages differ from TypeScript 7.
