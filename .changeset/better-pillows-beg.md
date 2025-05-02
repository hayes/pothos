---
"@pothos/plugin-drizzle": minor
---

Update all APIs to use RQBV2


## RQBV2 Changes

Please refer to https://rqbv2.drizzle-orm-fe.pages.dev/docs/relations-v1-v2 and https://rqbv2.drizzle-orm-fe.pages.dev/docs/relations-v2 for detailed instructions on setting up drizzle to use the RQBV2 API.

This currently requires installing `drizzle-orm@beta`

## Pothos breaking changes


### Setup

Setting up the plugin now requires the drizzle `relations` instead of the `schema`, as well as the `getTableConfig` function for your sql dialect:

```
import { drizzle } from 'drizzle-orm/...';
// Import the appropriate getTableConfig for your dialect
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import { relations } from './db/relations';

const db = drizzle(client, { relations });

type DrizzleRelations = typeof relations

export interface PothosTypes {
  DrizzleRelations: DrizzleRelations;
}

const builder = new SchemaBuilder<PothosTypes>({
  plugins: [DrizzlePlugin],
  drizzle: {
    client: db, // or (ctx) => db if you want to create a request specific client
    getTableConfig,
    relations,
  },
});
```

### Where and OrderBy

The `where` and `orderBy` options have changed to match the RQBv2 API:

```diff
    builder.drizzleObject('users', {
    name: 'User',
    fields: (t) => ({
        posts: t.relation('posts', {
        query: (args) => ({
-            where: (post, { eq }) => eq(post.published, true),
+            where: {
+                published: true,
+            },
-            orderBy: (post, { desc }) => desc(post.updatedAt),
+            orderBy: {
+                updatedAt: 'desc',
+            },
        }),
        }),
    }),
    });
```

### extras

`extras` no-longer require a `.as(name)` call, but must use a callback style to reference table columns:

```diff
const UserRef = builder.drizzleObject('users', {
  name: 'User',
  select: {
    extras: {
-      lowercaseName: sql<string>`lower(${users.firstName}).as('lowercaseName')`
+      lowercaseName: (users, sql) => sql<string>`lower(${users.firstName})`
    },
  },
});
```

### Other stuff

This release contains many other bug fixes, dozens of new tests, and a new `drizzleConnectionHelpers` API.
