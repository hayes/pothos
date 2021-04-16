---
name: Validation
menu: Plugins
---

# Validation Plugin

A plugin for adding validation for field arguments based on
[zod](https://github.com/colinhacks/zod). This plugin does not expose zod directly, but most of the
options map closely to the validations available in zod.

## Usage

### Install

```bash
yarn add @giraphql/plugin-validation
```

### Setup

```typescript
import ValidationPlugin from '@giraphql/plugin-validation';
const builder = new SchemaBuilder({
  plugins: [ValidationPlugin],
});

builder.queryType({
  fields: (t) => ({
    simple: t.boolean({
      nullable: true,
      args: {
        // Validate individual args
        email: t.arg.string({
          validate: {
            email: true,
          },
        }),
        phone: t.arg.string({}),
      },
      // Validate all args together
      validate: (args) => !!args.phone || !!args.email,
      resolve: () => true,
    }),
  }),
});
```

### Examples

#### With custom message

```typescript
builder.queryType({
  fields: (t) => ({
    withMessage: t.boolean({
      nullable: true,
      args: {
        email: t.arg.string({
          validate: {
            email: [true, { message: 'invalid email address' }],
          },
        }),
        phone: t.arg.string({}),
      },
      validate: [
        (args) => !!args.phone || !!args.email,
        { message: 'Must provide either phone number or email address' },
      ],
      resolve: () => true,
    }),
});
```

### Validating List

```typescript
builder.queryType({
  fields: (t) => ({
    list: t.boolean({
      nullable: true,
      args: {
        list: t.arg.stringList({
          validate: {
            items: {
              maxLength: 3,
            },
            maxLength: 3,
          },
        }),
      },
      resolve: () => true,
    }),
  }),
});
```

## API

### On Object fields

- `validate`: `Refinement<T>` | `Refinement<T>[]`.

### On InputObjects

- `validate`: `Refinement<T>` | `Refinement<T>[]`

### On arguments and fields on InputObjects

- `validate`: `Refinement` | `ValidationOptions`

### `Refinement`

A `Refinement` is a function that will be passed to the `zod` `refine` method. It receives the args
object, input object, or value of the specific field the refinement is defined on. It should return
a `boolean`.

`Refinement`s can either be just a function: `(val) => isValid(val)`, or an array with the function,
and an options object like: `[(val) => isValid(val), { message: 'field should be valid' }]`.

The options object may have a `message` property, and if the type being validated is an object, it
can also include a `path` property with an array of strings indicating the path of the field in the
object being validated. See the zod docs on `refine` for more details.

### `ValidationOptions`

The validation options available depend on the type being validated. Each property of
`ValidationOptions` can either be a value specific to the constraint, or an array with the value,
and the options passed to the underlying zod method. This options object can be used to set a custom
error message:

```ts
{
  validate: {
    max: [10, { message: 'should not be more than 10' }],
    int: true,
  }
}
```

#### Number

- `type`?: `'number'`
- `refine`?: `Refinement<number> | Refinement<number>[]`
- `min`?: `Constraint<number>`
- `max`?: `Constraint<number>`
- `positive`?: `Constraint<boolean>`
- `nonnegative`?: `Constraint<boolean>`
- `negative`?: `Constraint<boolean>`
- `nonpositive`?: `Constraint<boolean>`
- `int`?: `Constraint<boolean>`

#### BigInt

- `type`?: `'bigint'`
- `refine`?: `Refinement<bigint> | Refinement<bigint>[]`

#### Boolean

- `type`?: `'boolean'`
- `refine`?: `Refinement<boolean> | Refinement<boolean>[]`

#### String

- `type`?: `'string'`;
- `refine`?: `Refinement<string> | Refinement<string>[]`
- `minLength`?: `Constraint<number>`
- `maxLength`?: `Constraint<number>`
- `length`?: `Constraint<number>`
- `url`?: `Constraint<boolean>`
- `uuid`?: `Constraint<boolean>`
- `email`?: `Constraint<boolean>`
- `regex`?: `Constraint<RegExp>`

#### Object

- `type`?: `'object'`;
- `refine`?: `Refinement<T[]> | Refinement<T[]>[]`

#### Array

- `type`?: `'array'`;
- `refine`?: `Refinement<T[]> | Refinement<T[]>[]`
- `minLength`?: `Constraint<number>`
- `maxLength`?: `Constraint<number>`
- `length`?: `Constraint<number>`
- `items`?: `ValidationOptions<T> | Refinement<T>`

### How it works

Each arg on an object field, and each field on an input type with validation will build its own zod
validator. These validators will be a union of all potential types that can apply the validations
defined for that field. For example, if you define an optional field with a `maxLength` validator,
it will create a zod schema that looks something like:

```ts
zod.union([zod.null(), zod.undefined(), zod.array().maxLength(5), zod.string().maxLength(5)]);
```

If you set and `email` validation instead the schema might look like:

```ts
zod.union([zod.null(), zod.undefined(), zod.string().email()]);
```

At runtime, we don't know anything about the types being used by your schema, we can't infer the
expected js type from the type definition, so the best we can do is limit the valid types based on
what validations they support. The `type` validation allows explicitly validating the `type` of a
field to be one of the base types supported by zod:

```ts
// field
{
validate: {
  type: 'string',
  maxLength: 5
}
// generated
zod.union([zod.null(), zod.undefined(), zod.string().maxLength(5)]);
```

There are a few exceptions the the above:

1: args and input fields that are `InputObject`s always use `zod.object()` rather than creating a
union of potential types.

1. args and input fields that are list types always use `zod.array()`.

1. If you only include a `refine` validation (or just pass a function directly to validate) we will
   just use `zod`s unknown validator instead:

```ts
// field
{
  validate: (val) => isValid(val),
}
// generated
zod.union([zod.null(), zod.undefined(), zod.unknown().refine((val) => isValid(val))]);
```
