---
name: FieldBuilder
menu: Api
---

# FieldBuilder

## `field(options)`

* `options`: `FieldOptions`

### FieldOptions

```typescript
type FieldOptions = {
  type: ReturnType;
  args?: Args;
  nullable?: boolean;
  description?: string;
  deprecationReason?: string;
  resolve: (parent, args, context, info): ResolveValue;
};
```

* `type`: [Type Parameter](field-builder.md#type-parameter)
* `args`: a map of arg name to arg values. Arg values can be created using an [`InputFieldBuilder`](input-field-builder.md)

  \(`fieldBuilder.arg`\) or using `schemaBuilder.args`

* `nullable`: boolean, defaults to `false`, unless overwritten in SchemaBuilder see [Changing Default Nullability](../guide/changing-default-nullability.md).
* `description`: string
* `deprecationReason`: string
* `resolve`: [Resolver](field-builder.md#resolver)

### Type Parameter

A Type Parameter for a Field can be any `TypeRef` returned by one of the [`SchemaBuilder`](https://github.com/hayes/giraphql/tree/a813922505511a8b5971e4f2dcd9592dd9b98e30/docs/api/guide/schema-builder.md) methods for defining a type, a class used to create an object or interface type, a ts enum used to define a graphql enum type, or a string that corresponds to one of they keys of the `Objects`, `Interfaces`, or `Scalars` objects defined in `TypeInfo`.

For List fields, the Type Parameter should be one of the above wrapped in an array eg `['User']`.

### Resolver

A function to resolve the value of this field.

#### Return type

Field resolvers should return a value \(or promise\) that matches the expected type for this field. For `Scalars`, `Objects`, and `Interfaces` this type is the corresponding type defined `TypeInfo`. For Unions, the type may be any of the corresponding shapes of members of the union. For Enums, the value is dependent on the implementation of the enum. See `Enum` guide for more details.

#### Args

* `parent`: Parent will be a value of the backing model for the current type specified in

  `TypeInfo`.

* `args`: an object matching the shape of the args option for the current field
* `context`: The type `Context` type defined in `TypeInfo`.
* `info`: a GraphQLResolveInfo object see

  [https://graphql.org/graphql-js/type/\#graphqlobjecttype](https://graphql.org/graphql-js/type/#graphqlobjecttype)

  for more details.

## helpers

A set of helpers for creating scalar fields. This work the same as [`field`](field-builder.md#fieldoptions), but omit the `type` field from options.

### Scalars

* `string(options)`
* `id(options)`
* `boolean(options)`
* `int(options)`
* `float(options)`
* `stringList(options)`
* `idList(options)`
* `booleanList(options)`
* `intList(options)`
* `floatList(options)`

### expose

A set of helpers to expose fields from the backing model. The `name` arg can be any field from the backing model that matches the type being exposed. Options are the same as [`field`](field-builder.md#fieldoptions), but `type` and `resolve` are omitted.

* `exposeString(name, options)`
* `exposeID(name, options)`
* `exposeBoolean(name, options)`
* `exposeInt(name, options)`
* `exposeFloat(name, options)`
* `exposeStringList(name, options)`
* `exposeIDList(name, options)`
* `exposeBooleanList(name, options)`
* `exposeIntList(name, options)`
* `exposeFloatList(name, options)`

