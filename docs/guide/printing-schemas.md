---
name: Printing schemas
menu: Guide
---

# Printing Schema

Sometimes it's useful to have an SDL version of your schema. To do this, you can use some tools from
the `graphql` package to write your schema out as SDL to a file.

```typescript
import { writeFileSync } from 'fs';
import { printSchema, lexicographicSortSchema } from 'graphql';
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

const schema = builder.toSchema({});
const schemaAsString = printSchema(lexicographicSortSchema(schema));

writeFileSync('/path/to/schema.graphql', schemaAsString);
```

## Using graphql-code-generator

An alternative to printing your schema directly is to generate your schema file using
graphql-code-generator. See [Generating Client Types](./generating-client-types.md) for more details
