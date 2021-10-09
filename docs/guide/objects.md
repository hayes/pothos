---
name: Object Types
menu: Guide
---

# Object Types

This will walk you through creating your first object types, some concepts in this guide will be
explained further in later guides.

### Create some data

When adding a new type to your schema, you'll need to figure how the data behind this type will be
represented. In this guide, we will use a class to represent some information about giraffes. Using
classes is completely optional, but it's a good place to start, since it makes it easy to show all
the different ways that you can tie the shape of your data to a new object type.

```typescript
export class Giraffe {
  name: string;
  birthday: Date;
  heightInMeters: number;

  constructor(name: string, birthday: Date, heightInMeters: number) {
    this.name = name;
    this.birthday = birthday;
    this.heightInMeters = heightInMeters;
  }
}
```

### Define the type

You can use `builder.objectType` to add new `Object` types to your schema.

```typescript
const builder = new SchemaBuilder({});

builder.objectType(Giraffe, {
  name: 'Giraffe',
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({}),
});
```

The first argument is an `ObjectParam`, in this case the class that represent our giraffes. This is
used to convey type information about our underlying data, so that fields can know what properties
are available on the parent object.

### Add some fields

Fields define what data is available in your schema

```typescript
builder.objectType(Giraffe, {
  name: 'Giraffe',
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({
    name: t.exposeString('name', {}),
    age: t.int({
      resolve: (parent) => {
        // Do some date math to get an aproximate age from a birthday
        const ageDifMs = Date.now() - parent.birthday.getTime();
        const ageDate = new Date(ageDifMs); // miliseconds from epoch
        return Math.abs(ageDate.getUTCFullYear() - 1970);
      },
    }),
    height: t.float({
      resolve: (parent) => parent.heightInMeters,
    }),
  }),
});
```

In GiraphQL we never automatically expose properties from the underlying data. Each property we want
to add in our schema needs to be explicitly defined. The `fields` property in options object should
be a function that accepts one argument \(a
[FieldBuilder](https://github.com/hayes/giraphql/tree/70c9001213400223167776227d2e35309f619966/docs/field-builder.md)\)
and returns an object who's keys are the field names, and who's values are `FieldRefs`created by the
[FieldBuilder](https://github.com/hayes/giraphql/tree/70c9001213400223167776227d2e35309f619966/docs/field-builder.md).
Fields are explained in more detail in the [fields guide](fields.md).

## Add a query

We can create a root `Query` object with a field that returns a giraffe using `builder.queryType`

```typescript
builder.queryType({
  fields: (t) => ({
    giraffe: t.field({
      type: Giraffe,
      resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
    }),
  }),
});
```

The `type` parameter can use whatever was used as the first argument of `builder.objectType`, in
this case the Giraffe class. `builder.objectType` also returns a `Ref` object that can be used as a
`TypeParam`.

### Create a server

GiraphQL schemas build into a plain schema that uses types from the `graphql`package. This means it
should be compatible with most of the popular GraphQL server implementations for node. In this guide
we will use `apollo-server` but you can use whatever server you want.

```typescript
// import apollo-server at top of file
import { ApolloServer } from 'apollo-server';

// Build schema and start server with the types we wrote above
const schema = builder.toSchema({});

const server = new ApolloServer({ schema });

server.listen(8000, (error: unknown) => {
  if (error) {
    throw error;
  }

  console.log('🚀 Server started at http://127.0.0.1:8000');
});
```

### Query your data

1. Run your server \(either with `ts-node`\) by compiling your code and running it with node.
2. Open [http://127.0.0.1:8000](http://127.0.0.1:8000) to open the playground and query your API:

```graphql
query {
  giraffe {
    name
    age
    height
  }
}
```

## Different ways to define Object types

There are 3 different ways that you can provide type information to GiraphQL about what the
underlying data in your graph will be. Depending on how the rest of your application is structured
you can pick the approach that works best for you, or use a combination of different styles.

### Using classes

This is the approach used above. If your data is already represented as a class, this is a fairly
straight forward approach, since you can just use your existing classes anywhere that a `TypeParam`
is expected.

```typescript
const builder = new SchemaBuilder({});

builder.objectType(Giraffe, {
  name: 'Giraffe',
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({}),
});

builder.queryFields((t) => ({
  giraffe: t.field({
    type: Giraffe,
    resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
  }),
}));
```

### Using SchemaTypes

You can provide a type mappings when you create the [SchemaBuilder](schema-builder.md). This will
allow you to reference the type by name throughout your schema \(as a string\).

```typescript
const builder = new SchemaBuilder<{ Objects: { Giraffe: Giraffe } }>({});

builder.objectType('Giraffe', {
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({}),
});

builder.queryFields((t) => ({
  giraffe: t.field({
    type: 'Giraffe',
    resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
  }),
}));
```

This is ideal when you want to list out all the types for your schema in one place, or you have
interfaces/types that define your data rather than classes, and means you won't have to import
anything when referencing the object type in other parts of the schema.

The type signature for
[SchemaBuilder](https://github.com/hayes/giraphql/tree/70c9001213400223167776227d2e35309f619966/docs/schema-builder.md)
is described in more detail [later](schema-builder.md), for now, it is enough to know that the
`Objects` type provided to the schema builder allows you to map the names of object types to type
definitions that describe the data for those types.

### Using Refs

You can use an `ObjectRef` to reference your class and provide a `Generic` argument that describes
the shape or your data.

```typescript
const builder = new SchemaBuilder({});

const Giraffe = builder.objectRef<GiraffeShape>('Giraffe');

builder.objectType(Giraffe, {
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({}),
});

builder.queryFields((t) => ({
  giraffe: t.field({
    type: Giraffe,
    resolve: () => ({
      name: 'James',
      birthday: new Date(Date.UTC(2012, 11, 12)),
      height: 5.2,
    }),
  }),
}));
```

`ObjectRefs` are useful when you don't want to define all the types in a single place
\(`SchemaTypes`\) and your data is not represented as classes. Regardless of how you define your
object types, `builder.objectType` returns an `ObjectRef` that can be used as a type parameter in
other parts of the schema.

A slightly simplified version of the above could be written as

```typescript
const builder = new SchemaBuilder({});

const Giraffe = builder.objectRef<GiraffeShape>('Giraffe').implement({
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({}),
});

builder.queryFields((t) => ({
  giraffe: t.field({
    type: Giraffe,
    resolve: () => ({
      name: 'James',
      birthday: new Date(Date.UTC(2012, 11, 12)),
      height: 5.2,
    }),
  }),
}));
```

{% hint style="warning" %} If the type you are defining has a circular reference to itself \(either
directly, or through another type\) you may need to keep `builder.objectRef` and `ref.implement` as
separate statements for at least one of the types to allow typescript to correctly resolve the types
for your circular references. {% endhint %}
