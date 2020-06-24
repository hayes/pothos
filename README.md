# GiraphQL SchemaBuilder

GiraphQL is library for creating GraphQL schemas in typescript using a strongly typed code first
approach. The GiraphQL schema builder makes writing schemas easy by providing a simple clean API
with helpful auto-completes, and removing the need for compile steps or defining the same types in
multiple files.

```typescript
import SchemaBuilder from '@giraphql/core';
import { ApolloServer } from 'apollo-server';

const builder = new SchemaBuilder();

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

const server = new ApolloServer({
    schema: builder.toSchema(),
});

server.listen(3000);
```

## Full docs available at https://giraphql.com

## Development

### Setup

After cloning run

```bash
yarn install
yarn prepare
yarn build
```

### Scripts

-   `docz:dev`: start docs dev server to see a love local copy of docs site
-   `prepare`: re-create all the config files for tools used in this repo
-   `build`: runs typechecking and babel
-   `clean`: removes all build artifacts for code and docs
-   `lint {path to file/directory}`: runs linter (eslint)
-   `jest {path to file/directory}`: run run tests
-   `test`: runs typechecking, lint, and tests
-   `prettier`: formats code and docs
-   `type`: run typechecking
