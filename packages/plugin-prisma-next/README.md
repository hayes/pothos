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
to the builder. Importing both throws an error, and their type declarations conflict (TS2717 with
`skipLibCheck: false`; with `skipLibCheck: true`, one plugin's types silently replace the
other's).

## Example

```ts
import SchemaBuilder from '@pothos/core';
import prismaNextPlugin from '@pothos/plugin-prisma-next';
import RelayPlugin from '@pothos/plugin-relay';
import sqlite from '@prisma/orm-sqlite/runtime';
import { contractFromJson } from '@prisma/orm-sqlite/static';
import contractJson from './prisma/contract.json' with { type: 'json' };
import type { Contract } from './prisma/contract';

const contract = contractFromJson<Contract>(contractJson);
const db = sqlite({ contract, path: './app.db' });

const builder = new SchemaBuilder<{
  PrismaNextContract: Contract;
  Context: { db: typeof db };
}>({
  plugins: [RelayPlugin, prismaNextPlugin],
  prismaNext: { client: db },
});
```

The examples below come from the
[Prisma Next playground example](https://pothos-graphql.dev/playground?example=plugin-prisma-next).
An object type with a computed field and a filtered relation:

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
  }),
});
```

A related connection:

```ts
// Pages through the relation inside the query that loads the user.
builder.prismaObjectField('User', 'postConnection', (t) =>
  t.relatedConnection('posts', {
    cursor: 'id',
    query: { where: { published: 1 } },
    totalCount: true,
  }),
);
```

A root field returns a Collection, and the plugin applies the query's selection to it:

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

PostgreSQL and SQLite are supported, MySQL supports reads only (not covered by CI), and MongoDB is
not supported. Execute operations with a context object (`contextValue`), because the plugin
keeps per-request state on it.

See the [Prisma Next plugin docs](https://pothos-graphql.dev/docs/plugins/prisma-next) for the
full documentation.
