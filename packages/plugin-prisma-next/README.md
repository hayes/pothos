# Prisma Next Plugin

A Pothos plugin for [Prisma ORM 8](https://github.com/prisma/orm). It defines GraphQL types from
the models in a Prisma contract. Your resolvers return Collections, and the plugin adds what each
query selects before running them.

> [!WARNING]
> **Experimental.** This plugin targets Prisma ORM `8.0.0-rc.22` exactly. Its API, and Prisma's,
> may change in any release.

For Prisma ORM 7, use [`@pothos/plugin-prisma`](https://pothos-graphql.dev/docs/plugins/prisma)
instead. The two can't be used together.

## Example

Set up Prisma ORM 8 and your contract, then install the plugin:

```sh
npm install --save @pothos/core @pothos/plugin-prisma-next graphql
```

```ts
import SchemaBuilder from '@pothos/core';
import prismaNextPlugin from '@pothos/plugin-prisma-next';
import { contract, db } from './prisma/db';

const builder = new SchemaBuilder<{
  PrismaNextContract: typeof contract;
  Context: { db: typeof db };
}>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: db },
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    fullName: t.string({
      select: ['firstName', 'lastName'],
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    posts: t.relation('posts', {
      query: { where: { published: 1 }, orderBy: (post) => post.id.asc() },
    }),
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

See the [Prisma Next plugin docs](https://pothos-graphql.dev/docs/plugins/prisma-next) and the
[playground example](https://pothos-graphql.dev/playground?example=plugin-prisma-next).
