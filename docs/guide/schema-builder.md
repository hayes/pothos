---
name: SchemaBuilder
menu: Guide
---

The schema builder is the core of GiraphQL. It is used to create types, and then stich those types
into a GraphQL schema.

## Creating a Schema Builder

The SchemaBuilder takes a TypeParam that extends a Partial
[`TypeInfo`](/api-schema-builder#typeinfo).

These types are used as the backing models for the types defined by the SchemaBuilder.

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
    // Backing models/shapes for Objects
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

The types provided here are used to enforce the types in resolvers, both for resolver arguments and
return values.

```typescript
builder.objectType(
  // typechecked as one of the types provided above in the Object shape (In this case only Giraffe)
  'Giraffe',
  {
    fields: t => ({
      name: t.exposeString(
        // typechecked as one string property from the Giraffe shape defined above (in this case only name)
        'name',
      );
      firstInital: t.string({
        resolve: (giraffe) => giraffe.name.slice(0, 1) // giraffe will be the same type as Giraffe shape above
      })
    }),
  },
);
```
