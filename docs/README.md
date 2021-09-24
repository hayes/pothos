---
name: Overview
route: /
---

![GiraphQL](../website/public/assets/logo-name-light.svg)

## GiraphQL - A plugin based GraphQL schema builder for typescript

GiraphQL makes writing graphql schemas in typescript easy, fast and enjoyable. The core of GiraphQL adds 0 overhead at runtime, and has `graphql` as its only dependency.

By leaning heavily on typescripts ability to infer types, GiraphQL is the most type-safe way of writing GraphQL schemas in typescript/node while requiring very few manual type definitions and no code generation.

GiraphQL has a unique and powerful plugin system that makes every plugin feel like its features are built into the core library. Plugins can extend almost any part of the API by adding new options or methods that can take full advantage of GiraphQLs type system.

## Hello, World

```typescript
import { ApolloServer } from 'apollo-server';
import SchemaBuilder from '@giraphql/core';

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string(),
      },
      resolve: (parent, { name }) => `hello, ${name || 'World'}`,
    }),
  }),
});

new ApolloServer({
  schema: builder.toSchema({}),
}).listen(3000);
```

## Plugins that make GiraphQL even better

* [**Scope Auth**](plugins/scope-auth.md)

  Add global, type level, or field level authorization checks to your schema

* [**Validation**](plugins/validation.md)

  Validating your inputs and arguments

* [**Dataloader**](plugins/dataloader.md)

  Quickly define data-loaders for your types and fields to avoid n+1 queries.

* [**Relay**](plugins/relay.md)

  Easy to use builder methods for defining relay style nodes and connections, and helpful utilities

  for cursor based pagination.

* [**Simple Objects**](plugins/simple-objects.md)

  Define simple object types without resolvers or manual type definitions.

* [**Mocks**](plugins/mocks.md)

  Add mock resolver for easier testing

* [**Sub-Graph**](plugins/sub-graph.md)

  Build multiple subsets of your graph to easily share code between internal and external APIs.

* [**Directives**](plugins/directives.md)

  Integrate with existing schema graphql directives in a type-safe way.

* [**Smart Subscriptions**](plugins/smart-subscriptions.md)

  Make any part of your graph subscribable to get live updates as your data changes.

* [**Errors**](plugins/errors.md)

  A plugin for easily including error types in your GraphQL schema and hooking up error types to resolvers.

* [**Prisma**](plugins/prisma.md)

  A plugin for more efficient integration with prisma that can help solve n+1 issues and more efficienty resolve queries 

