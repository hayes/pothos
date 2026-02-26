# Required Typename Example

This example demonstrates a custom Pothos plugin that adds a `requiredTypename()` method to interface and union refs.

## What it does

The `requiredTypename()` method updates the TypeScript types of an interface or union ref to require that `__typename` is present as a required string property on any fields returning that interface or union. This helps ensure type safety when working with GraphQL's `__typename` field.

**Important:** When `__typename` is provided in resolved values, no `resolveType` or `isTypeOf` is required for unions and interfaces, as GraphQL can use the `__typename` field directly to determine the concrete type.

## Plugin Implementation

The plugin is implemented in `src/required-typename-plugin.ts` and includes:

1. **Type Declarations**: Global TypeScript declarations that add the `requiredTypename()` method to `InterfaceRef`, `ImplementableInterfaceRef`, and `UnionRef`
2. **Method Implementations**: Prototype methods attached to `InterfaceRef` and `UnionRef` classes that return the same ref with updated types

Note: This plugin doesn't need to be registered with the builder since it doesn't use any plugin hooks - it only adds methods and types.

## Usage

```typescript
import SchemaBuilder from '@pothos/core';
import './required-typename-plugin';

const builder = new SchemaBuilder({});

// Create a union with required typename
// When __typename is provided, no resolveType is required
const PetUnion = builder.unionType('Pet', {
  types: [DogType, CatType],
}).requiredTypename();

// Create an interface with required typename - chained immediately
const NodeInterface = builder.interfaceRef<{ id: string }>('Node').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
}).requiredTypename();

// Now when you use these types, TypeScript enforces __typename
builder.queryType({
  fields: (t) => ({
    pets: t.field({
      type: [PetUnion],
      resolve: () => {
        // TypeScript requires __typename to be present in the returned objects
        return [
          { __typename: 'Dog', name: 'Fido', breed: 'Golden Retriever' },
          { __typename: 'Cat', name: 'Whiskers', livesRemaining: 9 },
        ];
      },
    }),
  }),
});
```

## Running the Example

```bash
# Install dependencies (from repo root)
pnpm install

# Start the server
pnpm --filter @pothos-examples/required-typename start

# Run tests
pnpm --filter @pothos-examples/required-typename test

# Type check
pnpm --filter @pothos-examples/required-typename type
```

The server will start at http://localhost:4000/graphql with a GraphiQL interface.

## Example Query

```graphql
query ExampleQuery {
  pets {
    __typename
    ... on Dog {
      name
      breed
    }
    ... on Cat {
      name
      livesRemaining
    }
  }
  nodes {
    __typename
    id
    ... on Person {
      name
    }
    ... on Company {
      companyName
    }
  }
}
```
