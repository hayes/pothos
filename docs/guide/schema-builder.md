---
name: SchemaBuilder
menu: Guide
---

# SchemaBuilder

The schema builder is the core of GiraphQL. It is used to create types, and then stitch those types into a GraphQL schema.

## Creating a Schema Builder

The SchemaBuilder takes a generic type parameter that extends a Partial `SchemaTypes`.

```typescript
import SchemaBuilder from '@giraphql/core';

const builder = new SchemaBuilder<{
  // Type of the context object
  Context: {};
}>({
  // plugins may add options that can  be provided here
});
```

The types provided here are used to enforce the types in resolvers, both for resolver arguments and return values, but not all types need to be added to this SchemaTypes object. As described in the [Object guide](objects.md) there are a number of different ways to provide type information for a GiraphQL type.

## Backing models

GiraphQL is built around a concept of "backing models". This may be a little confusing at first, but once you get your head around it can be very powerful. When you implement a GraphQL schema, you really have 2 schemas. The obvious schema is your GraphQL schema and it is made up of the types you define with the schema builder. The second schema is the schema that describes your internal data, and the contracts between your resolvers.  The types that describe your data in your application will be different from the types described in your GraphQL for a number of reasons. The primitive types in typescript and GraphQL do not map cleanly to each other, so there will always be some translation between type types you have in your application, and the types that are defined in your GraphQL schema. This is part of the issue, but is not the full story. When mapping a model or object in your application to a type in your API some fields may match up directly, some fields may need to be loaded or transformed dynamically when requested, and other you may not want to expose at all.  These differences are why GiraphQL maintains a mapping of "backing models" \(typescript types\) to GraphQL types.

To put it simple, backing models are the types that describe the data as it flows through your application, which may be substantially different than the types describe in your GraphQL schema. Each object and interface type in your schema has a backing model that is tied to a typescript type that describes your data. These types are how GiraphQL types the parent argument and return type of your resolver functions \(among other things\).

Now that we covered what backing models are, lets go over where they come from. There are currently 3 ways that GiraphQL gets a backing model for an object or interface:

1. Classes: If you use classes when defining you object types, GiraphQL can infer that any field

   that resolves to that type should resolve to an instance of that class

2. TypeRefs: Every time you create a type with the schema builder, it returns a `TypeRef` object,

   which contains the backing model type for that type. Object Refs can also be created explicitly

   with the `builder.objectRef` method.

3. SchemaTypes: The `SchemaTypes` type that is passed into the generic parameter of the

   `SchemaBuilder` can also be used to provide backing models for various types. When you reference

   a type in your schema by name \(as a string\), GiraphQL checks the SchemaTypes to see if there is a

   backing model defined for that type.

