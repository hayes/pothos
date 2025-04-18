# Zod Validation Plugin

A plugin for adding validation for field arguments based on
[zod](https://github.com/colinhacks/zod). This plugin does not expose zod directly, but most of the
options map closely to the validations available in zod.

## Usage

### Install

To use the zod plugin you will need to install both `zod` package and the zod plugin:

```package-install
npm install --save zod @pothos/plugin-zod
```

### Setup

```typescript
import ZodPlugin from '@pothos/plugin-zod';
const builder = new SchemaBuilder({
  plugins: [ZodPlugin],
  zod: {
    // optionally customize how errors are formatted
    validationError: (zodError, args, context, info) => {
      // the default behavior is to just throw the zod error directly
      return zodError;
    },
  },
});

builder.queryType({
  fields: (t) => ({
    simple: t.boolean({
      args: {
        // Validate individual args
        email: t.arg.string({
          validate: {
            email: true,
          },
        }),
        phone: t.arg.string(),
      },
      // Validate all args together
      validate: (args) => !!args.phone || !!args.email,
      resolve: () => true,
    }),
  }),
});
```

## Options

`validationError`: (optional) A function that will be called when validation fails. The function
will be passed the the zod validation error, as well as the args, context and info objects. It can
throw an error, or return an error message or custom Error instance.

### Examples

#### With custom message

```typescript
builder.queryType({
  fields: (t) => ({
    withMessage: t.boolean({
      args: {
        email: t.arg.string({
          validate: {
            email: [true, { message: 'invalid email address' }],
          },
        }),
        phone: t.arg.string(),
      },
      validate: [
        (args) => !!args.phone || !!args.email,
        { message: 'Must provide either phone number or email address' },
      ],
      resolve: () => true,
    }),
  }),
});
```

### Validating List

```typescript
builder.queryType({
  fields: (t) => ({
    list: t.boolean({
      args: {
        list: t.arg.stringList({
          validate: {
            items: {
              email: true,
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

### Using your own zod schemas

If you just want to use a zod schema defined somewhere else, rather than using the validation
options you can use the `schema` option:

```typescript
builder.queryType({
  fields: (t) => ({
    list: t.boolean({
      args: {
        max5: t.arg.int({
          validate: {
            schema: zod.number().int().max(5),
          },
        }),
      },
      resolve: () => true,
    }),
  }),
});
```

You can also validate all arguments together using a zod schema:

```typescript
builder.queryType({
  fields: (t) => ({
    simple: t.boolean({
      args: {
        email: t.arg.string(),
        phone: t.arg.string(),
      },
      // Validate all args together using own zod schema
      validate: {
        schema: zod.object({
          email: zod.string().email(),
          phone: zod.string(),
        }),
      },
      resolve: () => true,
    }),
  }),
});
```

## API

### On Object fields (for validating field arguments)

- `validate`: `Refinement<T>` | `Refinement<T>[]` | `ValidationOptions`.

### On InputObjects (for validating all fields of an input object)

- `validate`: `Refinement<T>` | `Refinement<T>[]` | `ValidationOptions`.

### On arguments or input object fields (for validating a specific input field or argument)

- `validate`: `Refinement<T>` | `Refinement<T>[]` | `ValidationOptions`.

### `Refinement`

A `Refinement` is a function that will be passed to the `zod` `refine` method. It receives the args
object, input object, or value of the specific field the refinement is defined on. It should return
a `boolean` or `Promise<boolean>`.

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

```typescript
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
- `schema`?: `ZodSchema<number>`

#### BigInt

- `type`?: `'bigint'`
- `refine`?: `Refinement<bigint> | Refinement<bigint>[]`
- `schema`?: `ZodSchema<bigint>`

#### Boolean

- `type`?: `'boolean'`
- `refine`?: `Refinement<boolean> | Refinement<boolean>[]`
- `schema`?: `ZodSchema<boolean>`

#### Date

- `type`?: `'boolean'`
- `refine`?: `Refinement<boolean> | Refinement<boolean>[]`
- `schema`?: `ZodSchema<Date>`

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
- `schema`?: `ZodSchema<string>`

#### Object

- `type`?: `'object'`;
- `refine`?: `Refinement<T> | Refinement<T>[]`
- `schema`?: `ZodSchema<Ts>`

#### Array

- `type`?: `'array'`;
- `refine`?: `Refinement<T[]> | Refinement<T[]>[]`
- `minLength`?: `Constraint<number>`
- `maxLength`?: `Constraint<number>`
- `length`?: `Constraint<number>`
- `items`?: `ValidationOptions<T> | Refinement<T>`
- `schema`?: `ZodSchema<T[]>`

### How it works

Each arg on an object field, and each field on an input type with validation will build its own zod
validator. These validators will be a union of all potential types that can apply the validations
defined for that field. For example, if you define an optional field with a `maxLength` validator,
it will create a zod schema that looks something like:

```typescript
zod.union([zod.null(), zod.undefined(), zod.array().maxLength(5), zod.string().maxLength(5)]);
```

If you set and `email` validation instead the schema might look like:

```typescript
zod.union([zod.null(), zod.undefined(), zod.string().email()]);
```

At runtime, we don't know anything about the types being used by your schema, we can't infer the
expected js type from the type definition, so the best we can do is limit the valid types based on
what validations they support. The `type` validation allows explicitly validating the `type` of a
field to be one of the base types supported by zod:

```typescript
// field
{
validate: {
  type: 'string',
  maxLength: 5
}
// generated
zod.union([zod.null(), zod.undefined(), zod.string().maxLength(5)]);
```

There are a few exceptions the above:

1. args and input fields that are `InputObject`s always use `zod.object()` rather than creating a
   union of potential types.

1. args and input fields that are list types always use `zod.array()`.

1. If you only include a `refine` validation (or just pass a function directly to validate) we will
   just use `zod`s unknown validator instead:

```typescript
// field
{
  validate: (val) => isValid(val),
}
// generated
zod.union([zod.null(), zod.undefined(), zod.unknown().refine((val) => isValid(val))]);
```

If the validation options include a `schema` that schema will be used as an intersection wit the
generated validator:

```typescript
// field
{
  validate: {
    int: true,
    schema: zod.number().max(10),
}
// generated
zod.union([zod.null(), zod.undefined(),  zod.intersection(zod.number().max(10), zod.number().int())]);
```

### Sharing schemas with client code

The easiest way to share validators is the use the to define schemas for your fields in an external
file using the normal zod APIs, and then attaching those to your fields using the `schema` option.

```typescript
// shared
import { ValidationOptions } from '@pothos/plugin-zod';

const numberValidation = zod.number().max(5);

// server
builder.queryType({
  fields: (t) => ({
    example: t.boolean({
      args: {
        num: t.arg.int({
          validate: {
            schema: numberValidation,
          }
        }),
      },
      resolve: () => true,
    }),
  });
});

// client
numberValidator.parse(3) // pass
numberValidator.parse('3') // fail
```

You can also use the `createZodSchema` helper from the plugin directly to create zod Schemas from an
options object:

```typescript
// shared
import { ValidationOptions } from '@pothos/plugin-zod';

const numberValidation: ValidationOptions<number> = {
  max: 5,
};

// server
builder.queryType({
  fields: (t) => ({
    example: t.boolean({
      args: {
        num: t.arg.int({
          validate: numberValidation,
        }),
      },
      resolve: () => true,
    }),
  });
});

// client
import { createZodSchema } from '@pothos/plugin-zod';

const validator = createZodSchema(numberValidator);

validator.parse(3) // pass
validator.parse('3') // fail
```
