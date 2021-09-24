![GiraphQL](./website/public/assets/logo-name-auto.svg)

## GiraphQL - A plugin based GraphQL schema builder for typescript

GiraphQL makes writing graphql schemas in typescript easy, fast and enjoyable. The core of GiraphQL
adds 0 overhead at runtime, and has `graphql` as its only dependency.

By leaning heavily on typescripts ability to infer types, GiraphQL is the most type-safe way of
writing GraphQL schemas in typescript/node while requiring very few manual type definitions and no
code generation.

GiraphQL has a unique and powerful plugin system that makes every plugin feel like its features are
built into the core library. Plugins can extend almost any part of the API by adding new options or
methods that can take full advantage of GiraphQLs type system.

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

## Full docs available at https://giraphql.com

## Plugins that make GiraphQL even better

- ## [Scope Auth](https://giraphql.com/plugins/scope-auth)
  Add global, type level, or field level authorization checks to your schema
- ## [Validation](https://giraphql.com/plugins/validation)
  Validating your inputs and arguments
- ## [Dataloader](https://giraphql.com/plugins/dataloader)
  Quickly define data-loaders for your types and fields to avoid n+1 queries.
- ## [Relay](https://giraphql.com/plugins/relay)
  Easy to use builder methods for defining relay style nodes and connections, and helpful utilities
  for cursor based pagination.
- ## [Simple Objects](https://giraphql.com/plugins/simple-objects)
  Define simple object types without resolvers or manual type definitions.
- ## [Mocks](https://giraphql.com/plugins/mocks)
  Add mock resolver for easier testing
- ## [Sub-Graph](https://giraphql.com/plugins/sub-graph)
  Build multiple subsets of your graph to easily share code between internal and external APIs.
- ## [Directives](https://giraphql.com/plugins/directives)
  Integrate with existing schema graphql directives in a type-safe way.
- ## [Smart Subscriptions](https://giraphql.com/plugins/smart-subscriptions)
  Make any part of your graph subscribable to get live updates as your data changes.
- ## [Errors](https://giraphql.com/plugins/errors)
  A plugin for easily including error types in your GraphQL schema and hooking up error types to
  resolvers.
- ## [**Prisma**](https://giraphql.com/plugins/prisma)
  A plugin for more efficient integration with prisma that can help solve n+1 issues and more efficienty resolve queries 

