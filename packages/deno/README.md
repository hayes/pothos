# GiraphQL SchemaBuilder

GiraphQL is library for creating GraphQL schemas in typescript using a strongly typed code first
approach. The GiraphQL schema builder makes writing schemas easy by providing a simple clean API
with helpful auto-completes, and removing the need for compile steps or defining the same types in
multiple files.

```typescript
import SchemaBuilder from 'https://deno.land/x/giraphql/packages/core/mod.ts';
import { printSchema } from 'https://cdn.skypack.dev/graphql?dts';

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

console.log(printSchema(builder.toSchema()));
```

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
