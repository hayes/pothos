# Contributing to the Drizzle plugin

Notes for changing this package. The repository's `CONTRIBUTING.md` covers the rest.

## Runtime checks

Pothos trusts its developers and its types. Don't check again at runtime what the types already
enforce, such as table names, relation names, option shapes or which plugins are loaded, and don't
write tests that pass ill-typed values with `as never` to reach such a check. A stub that matches
the types must work.

Check at runtime only:

- input from API clients, such as cursors, node IDs and arguments;
- rules the types can't express or that depend on runtime values, such as the rows a resolver
  returns or the values callbacks return;
- a mistake that would otherwise return wrong data for well-typed code. Report that as a hole in
  the types as well.

For a rare edge case, reject it in the types, or with a `PothosSchemaError` while the schema is
built, or leave it unsupported. Don't add a runtime branch around it.

## Errors

Pick the error class by who has to act on it:

- **The developer, while the schema is built:** `PothosSchemaError`, with the detail in its
  message.
- **The API client, for bad input:** `PothosValidationError`, with a short fixed message such as
  `Invalid cursor.`. Don't include anything the client sent, or table or column names.
- **The developer, during a request:** an `Error` with the message `Unexpected error.` and the
  detail in its `cause`.

`PothosSchemaError` and `PothosValidationError` extend `GraphQLError`, so servers that mask
errors, such as GraphQL Yoga, still send them to the client. Errors from Drizzle and from
application callbacks are not wrapped.

## Running the tests

On a fresh checkout, build the packages from the repository root with `pnpm build`. Then, from
this package's directory:

```sh
pnpm vitest --run
```

Most tests use the SQLite database in `tests/example/db/dev.db`, which is committed and already
seeded by `tests/example/seed.ts`. The `tests/postgres-*.test.ts` files need PostgreSQL at
`postgresql://prisma:prisma@localhost:5455/drizzle`, or at `POTHOS_DRIZZLE_TEST_DATABASE_URL`, and
fail without it. They create their own tables and replace their rows. The repository's
`docker-compose.yml` starts that database as the `db` service:

```sh
docker compose up -d db
```

## Type checks

`pnpm type` checks the source and the tests, including the type tests (`tests/*.test-d.ts`).
Vitest also checks the type tests when it runs the suite.
