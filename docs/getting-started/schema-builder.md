---
name: SchemaBuilder
menu: Guide
---

# SchemaBuilder

The schema builder is the core of GiraphQL. It is used to create types, and then stitch those types into a GraphQL schema.

## Creating a Schema Builder

The SchemaBuilder takes a generic type parameter that extends a Partial `TypeInfo`.

These types are used to map type names to the typescript types that describe the data that used by those types.  For example, In the example below, when a resolver for a field of type `'Giraffe'` will be expected to return an object of the shape `{name: string, age: number }` and any field on the `Giraffe` type will receive an object with that same shape as it's first argument \(`parent`\).  

```typescript
import SchemaBuilder from '@giraphql/core';

const builder = new SchemaBuilder<{
    // Type of the context object
    Context: {};
    // parent type in root resolvers (Query, Mutation, Subscription)
    Root: {};
    // Backing models/shapes for Objects
    Objects: {
        Giraffe: { name: string; age: number };
    };
    // Backing models/shapes for Interfaces
    Interfaces: {
        Animal: { name: string };
    };
    // Shapes for built-in or custom scalrs
    Scalars: {
        // Defines a shape for both input (field args) and outout (resolver return types)
        ID: { Input: string; Output: string | number };
    };
}>({
    // plugins may add options that can be provided here
});
```

The types provided here are used to enforce the types in resolvers, both for resolver arguments and return values, but not all types need to be added to this TypeInfo object.  As described in the [Object guide](objects.md) there are a number of different ways to provide type information for a GiraphQL type.

