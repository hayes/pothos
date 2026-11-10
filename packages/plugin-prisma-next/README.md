# Prisma Next Plugin for Pothos

The Prisma Next plugin integrates [Prisma ORM 8](https://github.com/prisma/orm) with Pothos to build
a strongly typed GraphQL API from your Prisma models. Expose database fields and relations, add
computed fields, and support Relay nodes and paginated connections. Your GraphQL types and fields can
have different names and shapes from the underlying models.

Declare what each field needs, and the plugin combines those requirements with the incoming
GraphQL query. Prisma loads related data together, often in a single SQL statement, so you don't
need a separate resolver or database call for every relation. Field types are inferred from your
Prisma contract.

> [!WARNING]
> **Experimental.** This plugin targets Prisma ORM `8.0.0-rc.23` exactly. Its API, and Prisma's,
> may change in any release.

For Prisma ORM 7, use [`@pothos/plugin-prisma`](https://pothos-graphql.dev/docs/plugins/prisma)
instead. See [Migrating from the Prisma plugin](https://pothos-graphql.dev/docs/plugins/prisma-next/migrating-from-prisma)
for an existing schema. The two plugins can't be used together.
With `@pothos/plugin-scope-auth`, use version 4.3.0 or newer.

## Example

Set up Prisma ORM 8 and your contract, then install the plugin with its Prisma peers:

```sh
npm install --save @pothos/core @pothos/plugin-prisma-next @pothos/plugin-relay graphql @prisma/orm-family-sql@8.0.0-rc.23 @prisma/orm-framework@8.0.0-rc.23
```

Install every `@prisma/orm-*` package, including your database's (such as `@prisma/orm-postgres`),
at `8.0.0-rc.23`. A second copy of any of them breaks values passed between the two. The database
packages also need `temporal-polyfill`, which npm and pnpm install automatically; with Yarn, add it
yourself. Requires Node.js 22.20+ or 24.7+.

```ts
import SchemaBuilder from '@pothos/core';
import PrismaNextPlugin from '@pothos/plugin-prisma-next';
import RelayPlugin from '@pothos/plugin-relay';
import { contract, db } from './prisma/db';

const builder = new SchemaBuilder<{
  PrismaContract: typeof contract;
}>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  prisma: { client: db },
});
```

Define a `Post` type and its author relation:

```ts
builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});
```

The author's computed `fullName` declares the columns its resolver reads:

```ts
builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    // Selects its columns only when a query asks for this field.
    fullName: t.string({
      select: ['firstName', 'lastName'],
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
  }),
});
```

Add a query for the ten latest published posts:

```ts
builder.queryType({
  fields: (t) => ({
    recentPosts: t.prismaField({
      type: ['Post'],
      query: { where: { published: 1 }, orderBy: { id: 'desc' }, limit: 10 },
    }),
  }),
});
```

For `{ recentPosts { title author { fullName } } }`, the posts and their authors load in one SQL
statement, including the columns needed to compute each author's name.

`t.relatedConnection` adds a paginated list of published posts to an author profile:

```ts
// Pages through the relation inside the query that loads the user.
builder.prismaObjectField('User', 'postConnection', (t) =>
  t.relatedConnection('posts', {
    query: { where: { published: 1 } },
    totalCount: true,
  }),
);
```

`t.prismaConnection` does the same for query fields:

```ts
posts: t.prismaConnection({
  type: 'Post',
  totalCount: true,
  args: { newestFirst: t.arg.boolean() },
  // Chooses the direction per request; the plugin reverses it for backward pages.
  query: (args) => ({
    where: { published: 1 },
    orderBy: { id: args.newestFirst ? 'desc' : 'asc' },
  }),
}),
```

`collection` chooses the starting ORM query; `query` adds field filters and ordering; a custom
field's `select` declares the data its resolver reads. See
[Queries and selections](https://pothos-graphql.dev/docs/plugins/prisma-next/queries) for how they
combine. The examples use an imported `db`; request-scoped clients and transaction lifetimes are
covered in the [Transactions guide](https://pothos-graphql.dev/docs/plugins/prisma-next/transactions).

See the [Prisma Next plugin docs](https://pothos-graphql.dev/docs/plugins/prisma-next) and the
[playground example](https://pothos-graphql.dev/playground?example=plugin-prisma-next).

## TypeScript and Temporal

When exporting refs that select Temporal columns, or have a Temporal primary key, declaration emit
may require `temporal-spec` as a direct dependency. If TypeScript reports missing `Temporal`
globals, add `import type {} from 'temporal-spec/global'` to a declaration file in your project.
This supplies types only; runtime Temporal support still comes from your runtime or polyfill. See
[Setup](https://pothos-graphql.dev/docs/plugins/prisma-next/setup#typescript-and-temporal).

## Errors

Malformed IDs and cursors fail with `Invalid ID.` or `Invalid cursor.`, and IDs that aren't global
IDs with the Relay plugin's `Invalid global ID: …`. Errors the plugin detects in your runtime
configuration use `Unexpected error.`, with detail in `cause`. ORM errors and errors from your code
pass through unchanged and can name your models and columns, so mask them in your GraphQL server.
