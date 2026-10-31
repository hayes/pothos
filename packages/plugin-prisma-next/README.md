# Prisma Next Plugin

A Pothos plugin for [Prisma ORM 8](https://github.com/prisma/orm). It defines GraphQL types from
the models in a Prisma contract and applies the selections a query needs to the Collections your
resolvers return.

> [!WARNING]
> **Experimental.** This plugin targets Prisma ORM `8.0.0-rc.22` exactly. Other versions are not
> supported, and the API of both Prisma ORM 8 and this plugin may change in any release.

For Prisma ORM 7 and `@prisma/client`, use
[`@pothos/plugin-prisma`](https://pothos-graphql.dev/docs/plugins/prisma). The two plugins can't be
used in the same program: both add `prismaObject`, `prismaField` and the other `prisma*` methods
to the builder, and importing both throws an error.

## Example

```ts
import SchemaBuilder from '@pothos/core';
import prismaNextPlugin from '@pothos/plugin-prisma-next';
import sqlite from '@prisma/orm-sqlite/runtime';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import contractJson from './prisma/contract.json' with { type: 'json' };
import type { Contract } from './prisma/contract';

const contract = contractFromJson<Contract>(contractJson);
const client = sqlite({ contract, path: './app.db' });
await client.connect();

const builder = new SchemaBuilder<{
  PrismaNextContract: Contract;
  Context: { db: typeof client };
}>({
  plugins: [prismaNextPlugin],
  prismaNext: { client },
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts'),
  }),
});

builder.queryType({
  fields: (t) => ({
    users: t.prismaField({
      type: ['User'],
      resolve: (_root, _args, ctx) => ctx.db.orm.User,
    }),
  }),
});
```

## Examples

These come from the
[Prisma Next playground example](https://pothos-graphql.dev/playground?example=plugin-prisma-next).

An object with a computed field, a filtered relation and a related connection:

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
    // Loaded with its parent as part of one ORM query.
    posts: t.relation('posts', {
      query: { where: { published: 1 }, orderBy: (post) => post.id.asc() },
    }),
    // Pages through the relation inside that same query.
    postConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: { where: { published: 1 } },
      totalCount: true,
    }),
  }),
});
```

A root field returns a Collection; the plugin applies the query's selection to it:

```ts
users: t.prismaField({
  type: ['User'],
  resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
}),
```

A root connection, ordered per request:

```ts
posts: t.prismaConnection({
  type: 'Post',
  cursor: 'id',
  totalCount: true,
  args: { newestFirst: t.arg.boolean() },
  // Chooses the direction per request; the plugin reverses it for backward pages.
  orderBy: (post, args) => (args.newestFirst ? post.id.desc() : post.id.asc()),
  resolve: () => db.orm.Post.where({ published: 1 }),
}),
```

A connection over a relation, loaded with its parent:

```ts
// Pages through the relation inside that same query.
postConnection: t.relatedConnection('posts', {
  cursor: 'id',
  query: { where: { published: 1 } },
  totalCount: true,
}),
```

PostgreSQL and SQLite are supported, MySQL supports reads only (not covered by CI), and MongoDB is
not supported. Operations must be executed with a context object (`contextValue`), where the
plugin keeps per-request state.

Full documentation: [Prisma Next plugin](https://pothos-graphql.dev/docs/plugins/prisma-next).
