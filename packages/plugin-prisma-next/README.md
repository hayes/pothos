# Prisma Next Plugin

A Pothos plugin for [Prisma ORM 8](https://github.com/prisma/orm). It defines GraphQL types from
the models in a Prisma contract and applies the selections a query needs to the Collections your
resolvers return.

> [!WARNING]
> **Experimental.** This plugin targets Prisma ORM `8.0.0-rc.22` exactly. Other versions are not
> supported, and the API of both Prisma ORM 8 and this plugin may change in any release.

For Prisma 7 and `@prisma/client`, use
[`@pothos/plugin-prisma`](https://pothos-graphql.dev/docs/plugins/prisma).

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

PostgreSQL and SQLite are supported, MySQL supports reads only, and MongoDB is not supported.

Full documentation: [Prisma Next plugin](https://pothos-graphql.dev/docs/plugins/prisma-next).
