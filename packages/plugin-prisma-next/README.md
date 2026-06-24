# @pothos/plugin-prisma-next

Pothos plugin for [`prisma-next`](https://github.com/prisma/prisma-next) — the
new fluent collection-based ORM client. Provides tighter integration with
prisma-next, makes it easier to define types backed by your contract, helps
solve N+1 queries for relations, and ships Relay integrations for nodes and
connections.

> **Experimental.** `prisma-next` isn't on npm yet; this package is `private:
> true` in the workspace until prisma-next publishes.

## Features

- 🎨 Quickly define GraphQL types backed by your prisma-next contract.
- 🦺 Strong type-safety throughout the entire API.
- 🤝 Automatically resolve relationships from the GraphQL selection set.
- 🎣 Auto-include the columns/relations needed to resolve a query — no N+1s.
- 💅 GraphQL field names are decoupled from contract column names.
- 🔀 Relay integration for nodes and connections.
- 📚 Multiple GraphQL types backed by the same contract model (variants).

## Quick example

```ts
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import prismaNextPlugin from '@pothos/plugin-prisma-next';
import sqlite from '@prisma-next/sqlite/runtime';
import contractJson from './prisma/contract.json' with { type: 'json' };
import type { Contract } from './prisma/contract';

const client = sqlite<Contract>({ contractJson, path: './app.db' });
await client.connect();

const builder = new SchemaBuilder<{
  PrismaNextContract: Contract;
  Context: { db: typeof client };
}>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: contractJson as Contract },
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
      // Return the orm-client Collection. The plugin auto-applies the
      // selection from `info` (.select(...) / .include(...)) and
      // materializes via .all() — single-row vs list inferred from the
      // field type.
      resolve: (_root, _args, ctx) => ctx.db.orm.User,
    }),
  }),
});
```

Full docs: [pothos-graphql.dev/docs/plugins/prisma-next](https://pothos-graphql.dev/docs/plugins/prisma-next).
