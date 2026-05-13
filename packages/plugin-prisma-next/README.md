# @pothos/plugin-prisma-next

Pothos plugin for the [prisma-next](https://github.com/prisma/prisma-next) ORM
client. Auto-includes relations from the GraphQL selection set, Relay nodes
and connections, cursor pagination, and the usual ecosystem-plugin passthrough
(errors, scope-auth, with-input, complexity, directives).

> **Experimental.** prisma-next isn't on npm yet; this plugin tracks it from
> the `mh--plugin-prisma-next` branch and is `private: true` in the workspace
> until prisma-next publishes.

## Install

```bash
pnpm add @pothos/plugin-prisma-next
```

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
      resolve: (apply, _p, _a, ctx) => apply(ctx.db.orm.User).get(),
    }),
  }),
});
```

Full docs: [pothos-graphql.dev/docs/plugins/prisma-next](https://pothos-graphql.dev/docs/plugins/prisma-next).
