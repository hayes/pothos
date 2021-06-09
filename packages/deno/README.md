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

## Plugins that make GiraphQL even better

- ## [Scope Auth](plugins/scope-auth.md)
  Add global, type level, or field level authorization checks to your schema
- ## [Validation](plugins/validation.md)
  Validating your inputs and arguments
- ## [Dataloader](plugins/dataloader.md)
  Quickly define data-loaders for your types and fields to avoid n+1 queries.
- ## [Relay](plugins/relay.md)
- Easy to use builder methods for defining relay style nodes and connections, and helpful utilities
  for cursor based pagination.
- ## [Simple Objects](plugins/simple-objects.md)
  Define simple object types without resolvers or manual type definitions.
- ## [Mocks](plugins/mocks.md)
  Add mock resolver for easier testing
- ## [Sub-Graph](plugins/sub-graph.md)
  Build multiple subsets of your graph to easily share code between internal and external APIs.
- ## [Directives](plugins/directives.md)
  Integrate with existing schema graphql directives in a type-safe way.
- ## [Smart Subscriptions](plugins/smart-subscriptions.md)
  Make any part of your graph subscribable to get live updates as your data changes.

## Setup

### Imports

Most of the setup for deno works exactly the same way as it does for node. The main difference is
where things are imported from. GiraphQL and all its plugins are published as a single package on
deno.land. Each of the node packages available on npm are available in the `packages` directory:

```typescript
// Core
import SchemaBuilder from 'https://deno.land/x/giraphql/packages/core/mod.ts';
// Plugins:
import ValidationPlugin from 'https://deno.land/x/giraphql/packages/plugin-validation/mod.ts';
import ScopeAuthPlugin from 'https://deno.land/x/giraphql/packages/plugin-scope-auth/mod.ts';
// ...etc
```

### Server

Most of the docs and examples currently use apollo-server, because it is the simplest to set up for
node. Unfortunately apollo-server does not work in deno. Instead we can use GraphQL Helix:

```typescript
import { Application, Router } from 'https://deno.land/x/oak@v7.3.0/mod.ts';
// Currently the way helix exports graphiql doesn't work in deno, so we import the other parts directly, and import a very simple playground file from a gist.
import { shouldRenderGraphiQL } from 'https://cdn.jsdelivr.net/gh/contrawork/graphql-helix@master/packages/deno/should-render-graphiql.ts';
import { processRequest } from 'https://cdn.jsdelivr.net/gh/contrawork/graphql-helix@master/packages/deno/process-request.ts';
import { getGraphQLParameters } from 'https://cdn.jsdelivr.net/gh/contrawork/graphql-helix@master/packages/deno/get-graphql-parameters.ts';
import playground from 'https://gist.githubusercontent.com/hayes/5c99f7b4f71234452036fd88e142a825/raw/655245a052b10c2912a803c8a6d537096b73c10b/playground.ts';
// GiraphQL
import SchemaBuilder from 'https://deno.land/x/giraphql/packages/core/mod.ts';

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

const schema = builder.toSchema({});

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

GiraphQL uses `https://cdn.skypack.dev/graphql?dts` to make it easy to replace with an import map.
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

## Full docs available at https://giraphql.com/
