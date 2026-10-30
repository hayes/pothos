# @pothos/plugin-prisma-next

Pothos plugin for [Prisma ORM 8](https://github.com/prisma/orm)
(formerly Prisma Next), the fluent collection-based ORM client. Provides tighter integration with
Prisma, makes it easier to define types backed by your contract, helps
solve N+1 queries for relations, and ships Relay integrations for nodes and
connections.

> [!WARNING]
> **Experimental: do not use in production.** This plugin is pre-release and pinned to exactly
> Prisma ORM `8.0.0-rc.22`; other versions, including newer release candidates, are not supported.
> Both Prisma ORM 8 and this plugin's API can change in any release, without a migration path.

This is separate from [`@pothos/plugin-prisma`](https://pothos-graphql.dev/docs/plugins/prisma),
which targets Prisma 7 and `@prisma/client`.

The plugin depends on Prisma's shared SQL family, not a database dialect. Your
application supplies its Collection and owns the driver, connection, and
transaction. PostgreSQL and SQLite use the same Pothos configuration. MongoDB
uses a different upstream query API and is not supported.

The plugin applies GraphQL selections before executing a returned Collection.
Root resolvers return a Collection (or null for a nullable field). Configure
`prismaNext.collections` to enable batched fallback loading for conflicting
to-one selections and deferred fragments. Without it, deferred data loads eagerly
and conflicting to-one refinements are rejected.

Mutation resolvers write through the application client, then return a Collection
for the result. Keep the transaction active through GraphQL execution and throw
on execution errors when rollback is required. See the [mutation example](https://pothos-graphql.dev/docs/plugins/prisma-next/objects)
and [transaction guidance](https://pothos-graphql.dev/docs/plugins/prisma-next/setup#selection-and-transaction-lifetime).

## Features

- 🎨 Quickly define GraphQL types backed by your Prisma contract.
- 🦺 Strong type-safety throughout the entire API.
- 🤝 Automatically resolve relationships from the GraphQL selection set.
- 🎣 Auto-include the columns/relations needed to resolve a query — no N+1s.
- 💅 GraphQL field names are decoupled from contract column names.
- 🔀 Relay integration for nodes and connections.
- Cursor connections support nullable sort fields with explicit null placement
  and a non-null unique tie-breaker. Compatible preordered Collections are accepted.
- 📚 Multiple GraphQL types backed by the same contract model (variants).

## Quick example

```ts
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
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
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: {
    contract,
    collections: (ctx) => ({ User: ctx.db.orm.User }),
  },
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

Full documentation: [Prisma Next plugin](https://pothos-graphql.dev/docs/plugins/prisma-next).
