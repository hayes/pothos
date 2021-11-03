---
name: Generating Client Types
menu: Guide
---

# Generating types for client

GiraphQL does not have a built in mechanism for generating types to use with a client, but
[graphql-code-generator](https://www.graphql-code-generator.com/) can be configured to consume a
schema directly from your typescript files.

## export your schema

The first thing you will need is a file that exports your built schema. The schema should be
exported as `schema` or as the default export. This will be used to generate your client types, but
can also be the schema you use in your server.

```ts
// schema.ts

// Import the builder
import builder from './builder';

// Import your type definitions
import './types/Query';
import './types/User';
import './types/Posts';

// Build and export the schema
export const schema = builder.toSchema({});
```

## export schema in a js file

To be able to use your schema with
[graphql-code-generator](https://www.graphql-code-generator.com/), it will need to exported from a
javascript file. To do this we can use `@boost/module` to load the typescript file and re-export it
from a js file.

```bash
yarn add --dev @boost/module
```

```js
// build-schema.js
module.exports = require('@boost/module').requireModule(require.resolve('./schema.ts'));
```

## Set up graphql-code-generator

The following set up will generate a schema.graphql file, and apollo client hooks for queries
defined in your in your client ts and tsx files. The specifics of this config file should be updated
to match your own needs using docs from
[graphql-code-generator](https://www.graphql-code-generator.com/).

```bash
yarn add --dev @graphql-codegen/cli
# Plugins below can be replaced or omitted as needed to match your use case
yarn add --dev @graphql-codegen/schema-ast
yarn add --dev @graphql-codegen/typescript
yarn add --dev @graphql-codegen/typescript-operations
yarn add --dev @graphql-codegen/typescript-react-apollo
```

```yml
# codegen.yml
overwrite: true
errorsOnly: true
schema: build-schema.js
# This should be updated to match your client files
documents: 'client/**/!(*.d).{ts,tsx}'
generates:
  # This will take your schema and print an SDL schema.
  schema.graphql:
    plugins:
      - schema-ast
  # This will contain the generated apollo hooks and schema types needed to make type-safe queries with the apollo client
  __generated__/operations.ts:
    plugins:
      - typescript
      - typescript-operations
      - typescript-react-apollo
```

## Generating types

Your types can now be generated using. This can also be added as a script in `package.json`.

```bash
yarn graphql-codegen
```

## Watch mode

To get watch mode to work you will need to make a small change to your `build-schema.js` file. Watch
mode will re-load your `build-schema.js`, but other modules will still be in the require cache, and
not be reloaded. To work around this, we need to remove those files from the cache before importing
our schema:

```js
// build-schema.js

// delete cache entries for all files outside of node_modules
Object.keys(require.cache)
  .filter((key) => !key.includes('node_modules'))
  .forEach((key) => {
    delete require.cache[key];
  });

module.exports = require('@boost/module').requireModule(require.resolve('./schema.ts'));
```

You can now run your graphql codegen in watch mode to update your schema and client types as you
edit your code.

```bash
yarn graphql-codegen --watch './src/**/*.ts'
```

