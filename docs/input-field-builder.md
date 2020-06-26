---
name: InputFieldBuilder
menu: Api
---

# InputFieldBuilder

## `field(options)`

* `options`: \[`FieldOptions`\]

### FieldOptions

```typescript
type FieldOptions = {
  type: ReturnType;
  required?: boolean;
  description?: string;
  deprecationReason?: string;
};
```

* `type`: [Type Parameter](input-field-builder.md#type-parameter)
* `required`: boolean, default to false
* `description`: string
* `defaultValue`: default value for field, type based on `type` option.

### Type Parameter

A Type Parameter for a Field can be any `InputTypeRef` returned by one of the [`SchemaBuilder`](getting-started/schema-builder.md) methods for defining an `InputObject`, `Enum`, or `Scalar`, a ts enum used to define a graphql enum type, or a string that corresponds to one of they keys of the `Scalars` object defined in [`TypeInfo`](https://github.com/hayes/giraphql/tree/60178ac5e1fc945099d042e3f9b57ca3acc1810a/api-schema-builder/README.md#typeinfo).

## helpers

A set of helpers for creating scalar fields. This work the same as `field`, but omit the `type` field from options.

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

