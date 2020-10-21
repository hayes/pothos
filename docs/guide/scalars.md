---
name: Scalar Types
menu: Guide
---

# Scalars

## Adding GraphQL Scalars

To add a custom scalar that has been implemented as GraphQLScalar from [graphql-js](https://github.com/graphql/graphql-js)  you need to provide some type information in TypeInfo object of the builder:

```typescript
const builder = new SchemaBuilder<{
    Scalars: {
        Date: {
            Input: Date;
            Output: Date;
        };
    };
}>({});

builder.addScalarType('Date', CustomDateScalar, {});
```

The Input type is the type that will be used when when the type is used in an argument or `InputObject`. The Output type is used to validate the resolvers return the correct value when using the scalar in their return type.

## Defining your own scalars

```typescript
const builder = new SchemaBuilder<{
    Scalars: {
        PositiveInt: {
            Input: number;
            Output: number;
        };
    };
}>({});

builder.scalarType('PositiveInt', {
    serialize: (n) => n,
    parseValue: (n) => {
        if (n >= 0) {
            return n;
        }

        throw new Error('Value must be positive');
    },
});
```

## Using scalars

```typescript
builder.queryFields((t) => ({
    date: t.field({
        type: 'Date',
        resolve: () => new Date(),
    }),

    positive: t.field({
        type: 'PositiveInt',
        resolve: () => 5,
    }),
}));
```

