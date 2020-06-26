---
name: Defining Fields
menu: Guide
---

# Fields

Fields for [Object](objects.md) and [Interface](interfaces.md) types are defined using a shape function. This is a function that takes a [FieldBuilder](../field-builder.md) as an argument, and returns an object who's keys are field names, and who's values are fields created by the [FieldBuilder](../field-builder.md). These examples will mostly add fields to the `Query` type, but the topics covered in this guide should apply to any object or interface type.

## Scalars

Scalar fields can be defined a couple of different ways:

### Field method

```typescript
builder.queryType({
  fields: t => ({
    name: t.field({
      description: 'Name field'
      type: 'String',
      resolve: () => 'Gina',
    }),
  }),
});
```

### Convenience methods

Convenience methods are just a wrapper around the `field` method, that omit the `type` option.

```typescript
builder.queryType({
    fields: (t) => ({
        id: t.id({ resolve: () => '123' }),
        int: t.int({ resolve: () => 123 }),
        float: t.float({ resolve: () => 1.23 }),
        boolean: t.boolean({ resolve: () => false }),
        string: t.string({ resolve: () => 'abc' }),
        idList: t.idList({ resolve: () => ['123'] }),
        intList: t.intList({ resolve: () => [123] }),
        floatList: t.floatList({ resolve: () => [1.23] }),
        booleanList: t.booleanList({ resolve: () => [false] }),
        stringList: t.stringList({ resolve: () => ['abc'] }),
    }),
});
```

## Other types

Fields for non-scalar fields can also be created with the `field` method.

Some types like [Objects](objects.md) and [Interfaces](interfaces.md) can be referenced by name if they have a backing model defined in the schema builder.

```typescript
const builder = new SchemaBuilder<{
  Object: { Giraffe: { name: string }}};
}>({});

builder.queryType({
  fields: t => ({
    giraffe: t.field({
      description: 'A giraffe'
      type: 'Giraffe',
      resolve: () => ({ name: 'Gina' }),
    }),:
  }),
});
```

For types not described in the `TypeInfo` type provided to the builder, including types that can not be aded there like [Unions](unions.md) and [Enums](enums.md), you can use a `Ref` returned by the builder method that created them in the `type` parameter.  For types created using a class \([Objects](enums.md) or [Interfaces](interfaces.md)\) or [Enums](enums.md) created using a typescript enum, you can also use the the `class` or `enum` that was used to define them.

```typescript
const LengthUnit = builder.enumType('LengthUnit', {
    values: { Feet: {}, Meters: {} },
});

builder.objectType('Giraffe', {
    fields: (t) => ({
        preferredNeckLengthUnit: t.field({
            type: LengthUnit,
            resolve: () => 'Feet',
        }),
    }),
});

builder.queryType({
    fields: (t) => ({
        giraffe: t.field({
            type: 'Giraffe',
            resolve: () => ({ name: 'Gina' }),
        }),
    }),
});
```

## Lists

To create a list field, you can wrap the the type in an array

```typescript
builder.queryType({
  fields: t => ({
    giraffes: t.field({
      description: 'multiple giraffes'
      type: ['Giraffe'],
      resolve: () => [{ name: 'Gina' }, { name: 'James' }],
    }),
    giraffeNames: t.field({
      type: ['String'],
      resolve: () => ['Gina', 'James'],
    })
  }),
});
```

## Nullable fields

Unlike some other GraphQL implementations, fields in GiraphQL are required by default. It is still often desirable to make fields in your schema nullable.  This default is not currently configurable, but support for changing default nullability/requiredness will likely be added in the future.

```typescript
builder.queryType({
    fields: (t) => ({
        nullableField: t.field({
            type: 'String',
            nullable: true,
            resolve: () => null,
        }),
        nullableString: t.string({
            nullable: true,
            resolve: () => null,
        }),
        nullableList: t.field({
            type: ['String'],
            nullable: true,
            resolve: () => null,
        }),
        spareseList: t.field({
            type: ['String'],
            nullable: {
                list: false,
                items: true,
            },
            resolve: () => [null],
        }),
    }),
});
```

Note that by default even if a list field is nullable, the items in that list are not. The last example above shows how you can make list items nullable.

## Exposing fields from the underlying data

Some GraphQL implementations have a concept of "default resolvers" that can automatically resolve field that have a property of the same name in the underlying data. In GiraphQL, these relationships need to be explicitly defined, but there are helper methods that make exposing fields easier.

These helpers are not available for root types \(Query, Mutation and Subscription\), but will work on any other object type or interface.

```typescript
const builder = new SchemaBuilder<{
  Object: { Giraffe: { name: string }}};
}>({});

builder.objectType('Giraffe', {
  fields: t => ({
    name: t.exposeString('name', {})
  }),
});
```

The available expose helpers are:

* `exposeString`
* `exposeInt`
* `exposeFloat`
* `exposeBoolean`
* `exposeID`
* `exposeStringList`
* `exposeIntList`
* `exposeFloatList`
* `exposeBooleanList`
* `exposeIDList`

## Arguments

Arguments for a field can defined in the options for a field:

```typescript
builder.queryType({
    fields: (t) => ({
        giraffeByName: t.field({
            type: 'Giraffe',
            args: {
                name: t.arg.string({ required: true }),
            },
            resolve: (root, args) => {
                if (args.name !== 'Gina') {
                    throw new NotFoundError(`Unknown Giraffe ${name}`);
                }

                return { name: 'Gina' };
            },
        }),
    }),
});
```

For more information see the [Arguments Guide](args.md).

## Adding fields to existing type

In addition to being able to define fields when defining types, you can also add additional fields independently.  This is useful for breaking up types with a lot of fields into multiple files, or co-locating fields with their type \(eg add all query/mutation fields for a type in the same file where the type is defined\).

```typescript
builder.queryFields((t) => ({
  giraffe: t.field({
    type: Giraffe,
    resolve: () => new Giraffe('James', new Date(2012, 11, 12), 5.2),
  }),
}));

builder.objectField(Giraffe, 'ageInDogYears', (t) =>
  t.int({
    resolve: (parent) => parent.age * 7,
  }),
);
```

To see all they methods available for defining fields see the [SchemaBuilder API](schema-builder.md)

