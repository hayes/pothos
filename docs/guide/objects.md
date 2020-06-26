---
name: Object Types
menu: Guide
---

## Creating Object Types

This will walk you through creating your fist object types, some concepts in this guide will be
explained further in later guides.

1. Lets start by creating a class to represent a Giraffe. Classes are not required for defining
   objects, but in this example it is useful for showing the different ways an object type can be
   defined and used.

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

2. define a GraphQL Object type:

```typescript
const builder = new SchemaBuilder({});

builder.objectType(Giraffe, {
    description: 'Long necks, cool patterns, taller than you.',
    fields: (t) => ({}),
});
```

3. add some fields

```typescript
builder.objectType('Giraffe', {
    description: 'Long necks, cool patterns, taller than you.',
    fields: (t) => ({
        name: t.exposeString('name'),
        age: t.int({
            resolve: (parent) => {
                // Do some date math to get an aproximate age from a birthday
                const today = new Date(new Date().toDateString());
                const birthday = new Date(parent.birthday.toDateString());
                const ageDifMs = Number(today) - Number(birthday);
                const ageDate = new Date(ageDifMs);

                return Math.abs(ageDate.getUTCFullYear() - 1970);
            },
        }),
        height: t.float({
            resolve: (parent) => parent.heightMeters,
        }),
    }),
});
```

4. Add a Query object as an entry point for fetching instances of the Giraffe type

```typescript
builder.queryType({
    fields: (t) => ({
        giraffe: t.field({
            type: Giraffe,
            resolve: () => new Giraffe('James', new Date(2012, 11, 12), 5.2),
        }),
    }),
});
```

5. Create a server

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

6. Run your server (either with ts-node) by compiling your code and running it with node.
7. Open http://127.0.0.1:8000 to open the playground and query your API:

```graphql
query {
    giraffe {
        name
        age
        height
    }
}
```

### Differnt ways to define Object types

There are 3 ways you can define an Object type with a GiraphQL schema builder.

1.  You can provide a type mapping when you create the builder so you can use a string to refence
    the type:

```typescript
const builder = new SchemaBuilder<{ Objects: { Giraffe: Giraffe } }>({});

builder.objectType('Giraffe', {
    description: 'Long necks, cool patterns, taller than you.',
    fields: (t) => ({}),
});

builder.queryFields((t) => ({
    giraffe: t.field({
        type: 'Giraffe',
        resolve: () => new Giraffe('James', new Date(2012, 11, 12), 5.2),
    }),
}));
```

This is ideal when you want to list out all the types for your schema in one place, or you have
interfaces/types that define your data rather than classes, and means you won't have to import
anything when referencing the object type in other parts of the schema.

The type signature for SchemaBuilder is described in more detail later, for now, it is enough to
know that the `Objects` type provided to the schema builder allows you to map the names of object
types to typedefinitions that describe the data for those types.

2. You can use a the class directly without specifying the type anywhere.

```typescript
const builder = new SchemaBuilder({});

builder.objectType(Giraffe, {
    description: 'Long necks, cool patterns, taller than you.',
    fields: (t) => ({}),
});

builder.queryFields((t) => ({
    giraffe: t.field({
        type: Giraffe,
        resolve: () => new Giraffe('James', new Date(2012, 11, 12), 5.2),
    }),
}));
```

3. You can use an ObjectRef to describe the data type for

```typescript
const builder = new SchemaBuilder({});

const GiraffeRef = builder.objectRef<Giraffe>('Giraffe');

builder.objectType(GiraffeRef, {
    description: 'Long necks, cool patterns, taller than you.',
    fields: (t) => ({}),
});

builder.queryFields((t) => ({
    giraffe: t.field({
        type: GiraffeRef,
        resolve: () => new Giraffe('James', new Date(2012, 11, 12), 5.2),
    }),
}));
```

Regardless of how you define your object types, `builder.objectType` returns an `ObjectRef` that can
be used as a type paramiter in other parts of the schema.
