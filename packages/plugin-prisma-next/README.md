# Prisma Next Plugin

A Pothos plugin for [Prisma ORM 8](https://github.com/prisma/orm). It defines GraphQL types from
the models in a Prisma contract. Your resolvers return Collections, and the plugin adds what each
query selects before running them.

> [!WARNING]
> **Experimental.** This plugin targets Prisma ORM `8.0.0-rc.22` exactly. Its API, and Prisma's,
> may change in any release.

For Prisma ORM 7, use [`@pothos/plugin-prisma`](https://pothos-graphql.dev/docs/plugins/prisma)
instead. The two can't be used together.
With `@pothos/plugin-scope-auth`, use version 4.3.0 or newer.

## Example

Set up Prisma ORM 8 and your contract, then install the plugin:

```sh
npm install --save @pothos/core @pothos/plugin-prisma-next @pothos/plugin-relay graphql
```

```ts
import SchemaBuilder from '@pothos/core';
import prismaNextPlugin from '@pothos/plugin-prisma-next';
import RelayPlugin from '@pothos/plugin-relay';
import { contract, db } from './prisma/db';

const builder = new SchemaBuilder<{
  PrismaNextContract: typeof contract;
}>({
  plugins: [RelayPlugin, prismaNextPlugin],
  prismaNext: { client: db },
});
```

A `User` type with a computed name and a list of published posts:

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

A query field, in `builder.queryType({ fields: (t) => ({ ... }) })`, returns the Collection without
running it:

```ts
users: t.prismaField({
  type: ['User'],
  resolve: () => db.orm.User.orderBy((user) => user.id.asc()),
}),
```

`t.relatedConnection` turns a relation into a Relay connection:

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
  orderBy: (args) => ({ id: args.newestFirst ? 'desc' : 'asc' }),
  resolve: () => db.orm.Post.where({ published: 1 }),
}),
```

See the [Prisma Next plugin docs](https://pothos-graphql.dev/docs/plugins/prisma-next) and the
[playground example](https://pothos-graphql.dev/playground?example=plugin-prisma-next).
