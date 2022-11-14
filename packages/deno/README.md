![Pothos](https://pothos-graphql.dev/assets/logo-name-auto.svg)

# Pothos GraphQL

Pothos is a plugin based GraphQL schema builder for typescript.

It makes building graphql schemas in typescript easy, fast and enjoyable. The core of Pothos adds 0
overhead at runtime, and has `graphql` as its only dependency.

Pothos is the most type-safe way to build GraphQL schemas in typescript, and by leveraging type
inference and typescript's powerful type system Pothos requires very few manual type definitions and
no code generation.

Pothos has a unique and powerful plugin system that makes every plugin feel like its features are
built into the core library. Plugins can extend almost any part of the API by adding new options or
methods that can take full advantage of the Pothos type system.

## Hello, World

```typescript
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import SchemaBuilder from '@pothos/core';

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

const yoga = createYoga({
  schema: builder.toSchema(),
});

const server = createServer(yoga);

server.listen(3000);
```

## What sets Pothos apart

- Pothos was built from the start to leverage typescript for best-in-class type-safety.
- Pothos has a clear separation between the shape of your external GraphQL API, and the internal
  representation of your data.
- Pothos comes with a large plugin ecosystem that provides a wide variety of features while maintain
  great interoperability between plugins.
- Pothos does not depend on code-generation or experimental decorators for type-safety.
- Pothos has been designed to work at every scale from small prototypes to huge Enterprise
  applications, and is in use at some of the largest tech companies including Airbnb and Netflix.

## Plugins that make Pothos even better

- [**Auth**](https://pothos-graphql.dev/docs/plugins/scope-auth)

  Add global, type level, or field level authorization checks to your schema

- [**Complexity**](https://pothos-graphql.dev/docs/plugins/complexity)

  A plugin for defining and limiting complexity of queries

- [**Directives**](https://pothos-graphql.dev/docs/plugins/directives)

  Integrate with existing schema graphql directives in a type-safe way.

- [**Errors**](https://pothos-graphql.dev/docs/plugins/errors)

  A plugin for easily including error types in your GraphQL schema and hooking up error types to
  resolvers.

- [**Dataloader**](https://pothos-graphql.dev/docs/plugins/dataloader)

  Quickly define data-loaders for your types and fields to avoid n+1 queries.

- [**Mocks**](https://pothos-graphql.dev/docs/plugins/mocks)

  Add mock resolvers for easier testing

- [**Prisma**](https://pothos-graphql.dev/docs/plugins/prisma)

  A plugin for more efficient integration with prisma that can help solve n+1 issues and more
  efficienty resolve queries

- [**Relay**](https://pothos-graphql.dev/docs/plugins/relay)

  Easy to use builder methods for defining relay style nodes and connections, and helpful utilities
  for cursor based pagination.

- [**Simple Objects**](https://pothos-graphql.dev/docs/plugins/simple-objects)

  Define simple object types without resolvers or manual type definitions.

- [**Smart Subscriptions**](https://pothos-graphql.dev/docs/plugins/smart-subscriptions)

  Make any part of your graph subscribable to get live updates as your data changes.

- [**Sub-Graph**](https://pothos-graphql.dev/docs/plugins/sub-graph)

  Build multiple subsets of your graph to easily share code between internal and external APIs.

- [**Validation**](https://pothos-graphql.dev/docs/plugins/validation)

  Validating your inputs and arguments

## Setup

### Imports

Most of the setup for deno works exactly the same way as it does for node. The main difference is
where things are imported from. Pothos and all its plugins are published as a single package on
deno.land. Each of the node packages available on npm are available in the `packages` directory:

```typescript
// Core
import SchemaBuilder from 'https://deno.land/x/pothos/packages/core/mod.ts';
// Plugins:
import ValidationPlugin from 'https://deno.land/x/pothos/packages/plugin-validation/mod.ts';
import ScopeAuthPlugin from 'https://deno.land/x/pothos/packages/plugin-scope-auth/mod.ts';
// ...etc
```

### Server

```typescript
import { Application, Router } from 'https://deno.land/x/oak@v7.3.0/mod.ts';
// Currently the way helix exports graphiql doesn't work in deno, so we import the other parts directly, and import a very simple playground file from a gist.
import { shouldRenderGraphiQL } from 'https://cdn.jsdelivr.net/gh/contrawork/graphql-helix@master/packages/deno/should-render-graphiql.ts';
import { processRequest } from 'https://cdn.jsdelivr.net/gh/contrawork/graphql-helix@master/packages/deno/process-request.ts';
import { getGraphQLParameters } from 'https://cdn.jsdelivr.net/gh/contrawork/graphql-helix@master/packages/deno/get-graphql-parameters.ts';
import playground from 'https://gist.githubusercontent.com/hayes/5c99f7b4f71234452036fd88e142a825/raw/655245a052b10c2912a803c8a6d537096b73c10b/playground.ts';
// Pothos
import SchemaBuilder from 'https://deno.land/x/pothos/packages/core/mod.ts';

// Create app and router
const app = new Application();
const router = new Router();

// Create a very simple schema
const builder = new SchemaBuilder({});

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

const schema = builder.toSchema();

// Mount a route to serve the graphql API and playground
router.all('/graphql', async (context) => {
  // parse request
  const request = {
    body: await context.request.body({}).value,
    headers: context.request.headers,
    method: context.request.method,
    query: context.request.url.searchParams,
  };

  if (shouldRenderGraphiQL(request)) {
    context.response.body = playground({ endpoint: 'localhost:8080/graphql' });

    return;
  }
  // Extract the GraphQL parameters from the request
  const { operationName, query, variables } = getGraphQLParameters(request);

  // Validate and execute the query
  const result = await processRequest({
    operationName,
    query,
    variables,
    request,
    schema,
  });

  if (result.type === 'RESPONSE') {
    // We set the provided status and headers and just the send the payload back to the client
    result.headers.forEach(({ name, value }) => context.response.headers.set(name, value));

    context.response.status = result.status;
    context.response.body = result.payload;
  } else {
    // Omitting other response types for brevity, see graphql-helix docs for more a complete implementation
    throw new Error('Unsupported result type');
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log('Go to http://localhost:8080/graphql to open the playground');
await app.listen({ port: 8080 });
```

### GraphQL versions

The `graphql` library is written in a way that make tools that import different copies of graphql
incompatible. This means that we need a way to ensure that our graphql library versions are the same
across our dependencies. There isn't a perfect solution right now, but `import-maps` give us
something that works.

Pothos uses `https://cdn.skypack.dev/graphql?dts` to make it easy to replace with an import map.
GraphQL Helix currently uses
`https://cdn.skypack.dev/graphql@15.4.0-experimental-stream-defer.1?dts`

To get these 2 libraries to work together, we can define an import map like:

```json
{
  "imports": {
    "https://cdn.skypack.dev/graphql@15.4.0-experimental-stream-defer.1?dts": "https://cdn.skypack.dev/graphql@v15.5.0?dts",
    "https://cdn.skypack.dev/graphql?dts": "https://cdn.skypack.dev/graphql@v15.5.0?dts"
  }
}
```

This will let us run our app with both libraries using `https://cdn.skypack.dev/graphql@v15.5.0?dts`
(or any other version you want to use). It will be important to keep the versions in sync if you
update your dependencies.

## Running the app:

```bash
deno run --allow-net --import-map=import-map.json server-example.ts
```

## Full docs available at https://pothos-graphql.dev/
