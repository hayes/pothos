---
name: Overview
route: /
---

# GiraphQL SchemaBuilder

GiraphQL is a plugin based schema builder for creating code-first GraphQL schemas in typescript.

## Hello, World

```typescript
import { ApolloServer } from 'apollo-server';
import SchemaBuilder from '@giraphql/core';

const builder = new SchemaBuilder();

builder.queryType({
    fields: (t) => ({
        hello: t.string({
            args: {
                name: t.arg.string({}),
            },
            resolve: (parent, { name }) => `hello, ${name || 'World'}`,
        }),
    }),
});

new ApolloServer({
    schema: builder.toSchema({}),
}).listen(3000);
```

## What GiraphQL offers

-   A type safe way to build GraphQL schemas with miniaml manual type defintions and no build
    process for generating type definitions
-   A powerful plugin system that enables extending almost any part of the schema builder, as well
    as adding runtime features like authorization.
-   A set of plugins for common use cases:
    -   [`@giraphql/plugin-auth`](/plugins-auth): A plugin for adding authorization checks
        throughout your schema
    -   [`@giraphql/plugin-relay`](/plugins-relay): A plugin for adding builder methods for defining
        relay style nodes and connections, and some helpful utilities for cursor based pagination
    -   [`@giraphql/plugin-smart-subscriptions`](/plugins-smart-subscriptions): A plugin for a more
        graph friendly way of defining subscriotions.
    -   [`@giraphql/plugin-simple-objects`](/plugins-simple-objects): A plugin for creating simple
        objects and interfaces without resolvers or arguments.
    -   [`@giraphql/plugin-mocks`](/plugins-mocks): A plugin for mocking out resolvers in your
        schema.
    -   More plugins coming soon (including a plugin for Prisma)
