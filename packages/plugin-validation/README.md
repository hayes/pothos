# Validation plugin

Validate arguments and input objects before a field resolver runs. Attach a schema from any library
that implements [Standard Schema](https://standardschema.dev), including Zod, Valibot, and ArkType.
Validation can be asynchronous, and chained validators can transform the values passed to your resolver.
If validation fails, the resolver does not run.

## Run validation before a write

Run the valid registration, rejected registration, and saved-names query in order. The valid name
is trimmed to `Leia`; invalid input returns issue messages and paths. `savedNames` still contains
only `Leia`, because the rejected mutation never reaches its resolver. Reset the example to clear
its in-memory data before repeating the sequence.

```typescript
const Registration = builder.inputType('Registration', {
  fields: (t) => ({
    name: t
      .string({ required: true })
      .validate(z.string().trim().min(3, 'Name is too short')),
    email: t.string({ required: true, validate: z.email('Enter a valid email') }),
  }),
});
builder.mutationType({
  fields: (t) => ({
    register: t.string({
      args: { input: t.arg({ type: Registration, required: true }) },
      errors: { types: [InputValidationError] },
      resolve: (_, { input }) => {
        names.push(input.name);
        return input.name;
      },
    }),
  }),
});
```

[Run in the playground](https://pothos-graphql.dev/playground?example=plugin-validation)

This companion combines validation with the errors plugin to make issues queryable. To run its
full source locally, also install `@pothos/plugin-errors`. It explicitly sets `unsafelyHandleInputErrors: true`: validation details are public here, and a rejected input
returns before field authorization hooks run. See [the integration details](https://pothos-graphql.dev/docs/plugins/errors#with-validation-plugin)
before using that setting in an application. Change the minimum name length from `3` to `5`, rebuild,
and run the valid operation again to see it rejected.

## Usage

### Install

To use the validation plugin, you'll need to install the validation plugin and a compatible validation library:

```package-install
npm install --save @pothos/plugin-validation zod
# OR
npm install --save @pothos/plugin-validation valibot
# OR
npm install --save @pothos/plugin-validation arktype
```

### Setup

```typescript
import SchemaBuilder from '@pothos/core';
import ValidationPlugin from '@pothos/plugin-validation';
import { z } from 'zod'; // or your preferred validation library

const builder = new SchemaBuilder({
  plugins: [ValidationPlugin],
});

builder.queryType({
  fields: (t) => ({
    simple: t.boolean({
      args: {
        // Validate individual arguments
        email: t.arg.string({
          required: true,
          validate: z.string().email(),
        }),
      },
      resolve: () => true,
    }),
  }),
});
```

## Validation API Overview

The validation plugin supports validating inputs and arguments in several different ways:

- **Argument validation**: `t.arg.string({ validate: schema })` or `t.arg.string().validate(schema)` - Validate individual arguments
- **Validate all field args**: `t.field({ args, validate: schema, ... })` or `t.field({ args: t.validate(args, schema), ... })` - Validate all arguments together
- **Input type validation**: `builder.inputType('Input', { validate: schema, ... })` or `builder.inputType('Input', { ... }).validate(schema)` - Validate entire input objects
- **Input field validation**: `t.string({ validate: schema })` or `t.string().validate(schema)` - Validate individual input type fields

Each example below is independent. Reuse the setup imports and builder configuration, then use the
example's query and input definitions in place of any earlier ones.

## Validation Patterns

### Argument Validation

Validate each field argument independently using either the object syntax or chaining API:

```typescript
builder.queryType({
  fields: (t) => ({
    user: t.string({
      args: {
        email: t.arg.string({
          required: true,
          validate: z.string().email(),
        }),
        name: t.arg.string({ required: true })
          .validate(z.string().min(2).max(50)),
      },
      resolve: (_, args) => `User: ${args.name}`,
    }),
  }),
});
```

#### Data Transformation with Argument Validation

When using the chaining API, you can transform data as part of the validation process:

```typescript
builder.queryType({
  fields: (t) => ({
    processData: t.string({
      args: {
        // Convert comma-separated string to array
        tags: t.arg.string({ required: true })
          .validate(z.string().transform(str => str.split(',').map(s => s.trim()))),
      },
      resolve: (_, args) => {
        return `Processed ${args.tags.length} tags`;
      },
    }),
  }),
});
```

### Validating all Field Arguments Together

Pass `validate` on the output field to check its arguments together. Optional GraphQL arguments
can be omitted or explicitly `null`; use a schema that accepts both when those are valid inputs.

```typescript
builder.queryType({
  fields: (t) => ({
    contact: t.boolean({
      args: {
        email: t.arg.string(),
        phone: t.arg.string(),
      },
      // Ensure at least one contact method is provided
      validate: z
        .object({
          email: z.string().nullish(),
          phone: z.string().nullish(),
        })
        .refine(
          (args) => !!args.phone || !!args.email,
          { message: 'Must provide either phone or email' }
        ),
      resolve: () => true,
    }),
  }),
});
```

#### With transforms

Use `t.validate(args, schema)` to transform all arguments and infer the transformed resolver arguments:

```typescript
builder.queryType({
  fields: (t) => ({
    user: t.string({
      args: t.validate({
        email: t.arg.string(),
        phone: t.arg.string(),
      },
        z.object({
          email: z.string().nullish(),
          phone: z.string().nullish(),
        })
        .refine(
          (args) => !!args.phone || !!args.email,
          { message: 'Must provide either phone or email' }
        )
        .transform((args) => ({
          filter: {
            email: args.email ? args.email.toLowerCase() : undefined,
            phone: args.phone ? args.phone.replace(/\D/g, '') : undefined,
          },
        }))
      ),
      resolve: (_, args) => {
        // args has transformed shape:
        // { filter: { email?: string, phone?: string } }
        return `User filter: ${JSON.stringify(args.filter)}`;
      },
    }),
  }),
});
```

### Input Type Validation

Validate entire input objects with complex validation logic using either object syntax or chaining:

```typescript
// Object syntax
const UserInput = builder.inputType('UserInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    age: t.int({ required: true }),
  }),
  validate: z
    .object({
      name: z.string(),
      age: z.number(),
    })
    .refine((user) => user.name !== 'admin', {
      message: 'Username "admin" is not allowed',
    })
});
```

#### Input Type Transformation

Transform entire input types:

```typescript
const UserInput = builder.inputType('RawUserInput', {
  fields: (t) => ({
    fullName: t.string({ required: true }),
    email: t.string({ required: true }),
  }),
}).validate(
  z.object({
    fullName: z.string(),
    email: z.string().email(),
  }).transform(data => ({
    firstName: data.fullName.split(' ')[0],
    lastName: data.fullName.split(' ').slice(1).join(' '),
    email: data.email.toLowerCase(),
  }))
);

builder.queryType({
  fields: (t) => ({
    previewUser: t.string({
      args: {
        userData: t.arg({ type: UserInput, required: true }),
      },
      resolve: (_, args) => {
        // args.userData has transformed shape:
        // { firstName: string, lastName: string, email: string }
        return `User preview: ${args.userData.firstName} ${args.userData.lastName} <${args.userData.email}>`;
      },
    }),
  }),
});
```

### Input Field Validation

Validate individual fields within input types:

```typescript
const UserInput = builder.inputType('UserInput', {
  fields: (t) => ({
    name: t.string({
      required: true,
      validate: z.string().min(2).refine(
        (name) => name[0].toUpperCase() === name[0],
        { message: 'Name must be capitalized' }
      ),
    })
  }),
});
```

#### Input Field Transformation

Transform field values during validation:

```typescript
const UserInput = builder.inputType('UserInput', {
  fields: (t) => ({
    birthDate: t.string({ required: true })
      .validate(z.iso.date())
      .validate(z.string().transform(str => new Date(str))),
  }),
});
```


## Plugin Options

### 'validationError'

By default, failed validation throws `InputValidationError`, which contains Standard Schema issues
with their messages and paths. Set `validationError` to return your own error or message.

```typescript
const builder = new SchemaBuilder({
  plugins: [ValidationPlugin],
  validation: {
    validationError: (validationResult, args, context) => {
      // validationResult contains the standard-schema validation result
      return new Error(`Validation failed: ${validationResult.issues.map(i => i.message).join(', ')}`);
    },
  },
});
```

#### Return Values

Your error handler can return:

- **Error object**: Return a custom Error instance
- **String**: Return a string message (will be wrapped in a PothosValidationError)
- **Throw**: Throw an error directly

To return validation failures as typed GraphQL results, see the
[errors plugin integration](https://pothos-graphql.dev/docs/plugins/errors#with-validation-plugin). This requires
`unsafelyHandleInputErrors`, because input validation runs before field authorization hooks.

### Validation Execution Order

Understanding when and how validations are executed:

1. **Input Field Validation**: Individual input fields are validated first
2. **Input Type Validation**: Whole input object validation runs after field validation passes
3. **Argument Validation**: Individual field arguments are validated
4. **Field-Level Validation**: The output field's `validate` option and `t.validate()` run last

When there are multiple validations for the same field or type, they are executed in order, so that any transforms are applied before passing to the next schema.
Validations for separate fields or arguments are executed in parallel, and their results are merged into a single set of issues.
