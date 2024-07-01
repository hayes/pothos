![Pothos](https://pothos-graphql.dev/assets/logo-name-dark.svg)

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

## Note on deno.land

Currently deno.land does not work well with the way versions are tagged in pothos. See instructions
below for details on how to use pothos with other deno compatible CDNs!

## Hello, World

```typescript
import { serve } from 'https://deno.land/std@0.157.0/http/server.ts';
import { createYoga } from 'graphql-yoga';
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string({}),
      },
      resolve: (_, { name }) => `hello, ${name || 'World'}`,
    }),
  }),
});

const yoga = createYoga({
  schema: builder.toSchema(),
});

serve(yoga, {
  onListen({ hostname, port }) {
    console.log(`Listening on http://${hostname}:${port}/graphql`);
  },
});
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

- [**Zod Validation**](https://pothos-graphql.dev/docs/plugins/zod)

  Validating your inputs and arguments

## Imports

There are a number of different ways to import Pothos, but the best option is ussually to set up
[import maps](https://deno.land/manual@v1.28.3/basics/modules/import_maps) and import from
[esm.sh](https://esm.sh).

### Import maps

```json
// import_maps.json
{
  "imports": {
    // define a version of graphql, this should be shared by all graphql libraries
    "graphql": "https://esm.sh/graphql@16.6.0",
    // Marking graphql as external will all the graphql from this import_map to be used
    "graphql-yoga": "https://esm.sh/graphql-yoga?external=graphql",
    // the `*` prefix in the package name marks all depenencies (only graphql in this case) as external
    // this ensures the version of graphql defined above is used
    "@pothos/core": "https://esm.sh/*@pothos/core@3.23.1",
    // Plugins should mark all dependencies as external as well
    // this will ensure that both graphql and @pothos/core use the versions defined above
    // some plugins like validation may require additional dependencies to be added to the import map (eg. zod)
    "@pothos/plugin-relay": "https://esm.sh/*@pothos/plugin-relay@3.30.0"
  }
}
```

### deno.json

```json
// deno.jsonc
{
  "importMap": "import_map.json"
}
```

## Server

```typescript
// src/index.ts
import { serve } from 'https://deno.land/std@0.157.0/http/server.ts';
import { createYoga } from 'graphql-yoga';
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string({}),
      },
      resolve: (_, { name }) => `hello, ${name || 'World'}`,
    }),
  }),
});

const yoga = createYoga({
  schema: builder.toSchema(),
});

serve(yoga, {
  onListen({ hostname, port }) {
    console.log(`Listening on http://${hostname}:${port}/graphql`);
  },
});
```

## Running the app:

```bash
deno run --allow-net src/index.ts
```

## Without import maps

In some cases (like when using the deno deploy playground) you may not be able to use import maps.
In this case, you can use query parameters with esm.sh to ensure that shared versions of packages
are used:

```ts
import { serve } from 'https://deno.land/std@0.157.0/http/server.ts';
// for graphql-yoga and pothos/core 'graphql' is the most import depencency to pin
import { createYoga } from 'https://esm.sh/graphql-yoga@3.1.1?deps=graphql@16.6.0';
import SchemaBuilder from 'https://esm.sh/@pothos/core@3.23.1?deps=graphql@16.6.0';
// for pothos plugins, you should pin both 'graphql' and '@pothos/core'
import RelayPlugin from 'https://esm.sh/@pothos/plugin-relay@3.30.0?deps=graphql@16.6.0,@pothos/core@3.23.1';
```

## The @pothos/deno package

The `@pothos/deno` package contains a typescript-only version of most of the pothos plugins. This is
no longer the recommended way to use pothos with deno, but will continue to be published with new
changes.

The files for this package are published to npm, and can be consumed from a number of CDNs. The
benefit of this is that all plugins are bundled with pothos/core, and import directly so you do not
need to mess with dependencies to ensure that plugins are using the correct version of pothos/core.

### example

```typescript
// dependencies of @pothos/deno are imported from https://cdn.skypack.dev/{package} to ensure
// that the same version of 'graphql' is used, import other dependencies from sky pack as well
import { serve } from 'https://deno.land/std@0.157.0/http/server.ts';
import { createYoga } from 'https://cdn.skypack.dev/graphql-yoga@3.1.1';
import SchemaBuilder from 'https://esm.sh/@pothos/deno/packages/core/mod.ts';
import RelayPlugin from 'https://esm.sh/@pothos/deno/packages/plugin-relay/mod.ts';
```

Pothos uses `https://cdn.skypack.dev/graphql?dts` which can be added to an import map to import a
different version of graphql.
