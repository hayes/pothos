# Errors Plugin
---
title: Errors plugin
description: Errors plugin docs for Pothos
---

A plugin for easily including error types in your GraphQL schema and hooking up error types to
resolvers

## Usage

### Install

```bash
npm install --save @pothos/plugin-errors
```

### Setup

Ensure that the target in your `tsconfig.json` is set to `es6` or higher (default is `es3`).

### Example Usage

```typescript
import ErrorsPlugin from '@pothos/plugin-errors';
const builder = new SchemaBuilder({
  plugins: [ErrorsPlugin],
  errors: {
    defaultTypes: [],
    // onResolvedError: (error) => console.error('Handled error:', error),
  },
});

builder.objectType(Error, {
  name: 'Error',
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      errors: {
        types: [Error],
      },
      args: {
        name: t.arg.string({ required: false }),
      },
      resolve: (parent, { name }) => {
        if (name.slice(0, 1) !== name.slice(0, 1).toUpperCase()) {
          throw new Error('name must be capitalized');
        }

        return `hello, ${name || 'World'}`;
      },
    }),
  }),
});
```

The above example will produce a GraphQL schema that looks like:

```graphql
type Error {
  message: String!
}

type Query {
  hello(name: String!): QueryHelloResult
}

union QueryHelloResult = Error | QueryHelloSuccess

type QueryHelloSuccess {
  data: String!
}
```

This field can be queried using fragments like:

```graphql
query {
  hello(name: "World") {
    __typename
    ... on Error {
      message
    }
    ... on QueryHelloSuccess {
      data
    }
  }
}
```

This plugin works by wrapping fields that define error options in a union type. This union consists
of an object type for each error type defined for the field, and a Success object type that wraps
the returned data. If the fields resolver throws an instance of one of the defined errors, the
errors plugin will automatically resolve to the corresponding error object type.

### Builder options

- `defaultTypes`: An array of Error classes to include in every field with error handling.
- `directResult`: Sets the default for `directResult` option on fields (only affects non-list
  fields)
- `onResolvedError`: A callback function that is called when an error is handled by the plugin
- `defaultResultOptions`: Sets the defaults for `result` option on fields.
  - `name`: Function to generate a custom name on the generated result types.
    ```ts
    export const builderWithCustomErrorTypeNames = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin, ValidationPlugin],
      errors: {
        defaultTypes: [Error],
        defaultResultOptions: {
          name: ({ parentTypeName, fieldName }) => `${fieldName}_Custom`,
        },
        defaultUnionOptions: {
          name: ({ parentTypeName, fieldName }) => `${fieldName}_Custom`,
        },
      },
    });
    ```
- `defaultUnionOptions`: Sets the defaults for `result` option on fields.
  - `name`: Function to generate a custom name on the generated union types.
    ```ts
    export const builderWithCustomErrorTypeNames = new SchemaBuilder<{}>({
      plugins: [ErrorPlugin, ValidationPlugin],
      errors: {
        defaultTypes: [Error],
        defaultResultOptions: {
          name: ({ parentTypeName, fieldName }) => `${fieldName}_Custom`,
        },
        defaultUnionOptions: {
          name: ({ parentTypeName, fieldName }) => `${fieldName}_Custom`,
        },
      },
    });
    ```

### Options on Fields

- `types`: An array of Error classes to catch and handle as error objects in the schema. Will be
  merged with `defaultTypes` from builder.
- `union`: An options object for the union type. Can include any normal union type options, and
  `name` option for setting a custom name for the union type.
- `result`: An options object for result object type. Can include any normal object type options,
  and `name` option for setting a custom name for the result type.
- `dataField`: An options object for the data field on the result object. This field will be named
  `data` by default, but can be written by passing a custom `name` option.
- `directResult`: Boolean, can only be set to true for non-list fields. This will directly include
  the fields type in the union rather than creating an intermediate Result object type. This will
  throw at build time if the type is not an object type.

### Recommended Usage

1. Set up an Error interface
2. Create a BaseError object type
3. Include the Error interface in any custom Error types you define
4. Include the BaseError type in the `defaultTypes` in the builder config

This pattern will allow you to consistently query your schema using a `... on Error { message }`
fragment since all Error classes extend that interface. If your client wants to query details of
more specialized error types, they can just add a fragment for the errors it cares about. This
pattern should also make it easier to make future changes without unexpected breaking changes for
your clients.

The following is a small example of this pattern:

```typescript
import ErrorsPlugin from '@pothos/plugin-errors';
const builder = new SchemaBuilder({
  plugins: [ErrorsPlugin],
  errors: {
    defaultTypes: [Error],
  },
});

const ErrorInterface = builder.interfaceRef<Error>('Error').implement({
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

builder.objectType(Error, {
  name: 'BaseError',
  interfaces: [ErrorInterface],
});

class LengthError extends Error {
  minLength: number;

  constructor(minLength: number) {
    super(`string length should be at least ${minLength}`);

    this.minLength = minLength;
    this.name = 'LengthError';
  }
}

builder.objectType(LengthError, {
  name: 'LengthError',
  interfaces: [ErrorInterface],
  fields: (t) => ({
    minLength: t.exposeInt('minLength'),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Simple error handling just using base error class
    hello: t.string({
      errors: {},
      args: {
        name: t.arg.string({ required: true }),
      },
      resolve: (parent, { name }) => {
        if (!name.startsWith(name.slice(0, 1).toUpperCase())) {
          throw new Error('name must be capitalized');
        }

        return `hello, ${name || 'World'}`;
      },
    }),
    // Handling custom errors
    helloWithMinLength: t.string({
      errors: {
        types: [LengthError],
      },
      args: {
        name: t.arg.string({ required: true }),
      },
      resolve: (parent, { name }) => {
        if (name.length < 5) {
          throw new LengthError(5);
        }

        return `hello, ${name || 'World'}`;
      },
    }),
  }),
});
```

### With validation plugin

To handle validation errors you will need to enable the `unsafelyHandleInputErrors` option in the
errors plugin options. This will allow the errors plugin to catch errors thrown by the validation plugin.
This setting is unsafe because it wraps and catches errors at a higher level which will allow you to
bypass other plugin hooks like the `auth` plugin.  This enables you to return structured error responses for
validation issues which happen BEFORE auth checks are executed, but this also means that those auth checks won't be run.

Once you enable the `unsafelyHandleInputErrors` option, you can define types for an InputValidationError
(or any custom error you use in the validation plugin), the same way you would for any other error type. Below
is a simple example of how this can be done, but the specifics of how you structure your error types are left up to you.

```typescript
const InputValidationIssue = builder
  .objectRef<StandardSchemaV1.Issue>('InputValidationIssue')
  .implement({
    fields: (t) => ({
      message: t.exposeString('message'),
      path: t.stringList({
        resolve: (issue) => issue.path?.map((p) => String(p)),
      }),
    }),
  });

builder.objectType(InputValidationError, {
  name: 'InputValidationError',
  interfaces: [ErrorInterface],
  fields: (t) => ({
    issues: t.field({
      type: [InputValidationIssue],
      resolve: (err) => err.issues,
    }),
  }),
});

builder.queryField('fieldWithValidation', (t) =>
  t.boolean({
    errors: {
      types: [InputValidationError],
    },
    args: {
      string: t.arg.string({
        validate: z.string().min(3, 'Too short'),
      }),
    },
    resolve: () => true,
  }),
);
```

Example query:

```graphql
query {
  validation(string: "a") {
    __typename
    ... on QueryValidationSuccess {
      data
    }
    ... on InputValidationError {
      issues {
        message
        path
      }
    }
  }
}
```

### With the dataloader plugin

To use this in combination with the dataloader plugin, ensure that the errors plugin is listed
BEFORE the dataloader plugin in your plugin list.

If a field with `errors` returns a `loadableObject`, or `loadableNode` the errors plugin will now
catch errors thrown when loading ids returned by the `resolve` function.

If the field is a `List` field, errors that occur when resolving objects from `ids` will not be
handled by the errors plugin. This is because those errors are associated with each item in the list
rather than the list field itself. In the future, the dataloader plugin may have an option to throw
an error at the field level if any items can not be loaded, which would allow the error plugin to
handle these types of errors.

### With the prisma plugin

To use this in combination with the prisma plugin, ensure that the errors plugin is listed BEFORE
the prisma plugin in your plugin list. This will enable `errors` option to work correctly with any
field builder method from the prisma plugin.

`errors` can be configured for any field, but if there is an error pre-loading a relation the error
will always be surfaced at the field that executed the query. Because there are cases that fall back to
executing queries for relation fields, these fields may still have errors if the relation was not
pre-loaded. Detection of nested relations will continue to work if those relations use the `errors`
plugin

### List item errors

For fields that return lists, you can specify `itemErrors` to wrap the list items in a union type so
that errors can be handled per-item rather than replacing the whole list with an error.

The `itemErrors` options are exactly the same as the `errors` options, but they are applied to each
item in the list rather than the whole list.

```typescript
builder.queryType({
  fields: (t) => ({
    listWithErrors: t.string({
      itemErrors: {},
      resolve: (parent, { name }) => {
        return [
          1,
          2,
          new Error('Boom'),
          3,
        ]
      },
    }),
  }),
});
```

This will produce a GraphQL schema that looks like:

```graphql
type Query {
  listWithErrors: [QueryListWithErrorsItemResult!]!
}

union QueryListWithErrorsItemResult = Error | QueryListWithErrorsItemSuccess

type QueryListWithErrorsItemSuccess {
  data: Int!
}
```

Item errors also works with both sync and async iterators (in graphql@>=17, or other executors that support the @stream directive):

```typescript
builder.queryType({
  fields: (t) => ({
    asyncListWithErrors: t.string({
      itemErrors: {},
      resolve: async function* () {
        yield 1;
        yield 2;
        yield new Error('Boom');
        yield 4;
        throw new Error('Boom');
      },
    }),
  }),
});
```

When an error is yielded, an error result will be added into the list, if the generator throws an error,
the error will be added to the list, and no more results will be returned for that field


You can also use the `errors` and `itemErrors` options together:

```typescript

builder.queryType({
  fields: (t) => ({
    listWithErrors: t.string({
      itemErrors: {},
      errors: {},
      resolve: (parent, { name }) => {
        return [
          1,
          new Error('Boom'),
          3,
        ]
    }),
  }),
});
```

This will produce a GraphQL schema that looks like:

```graphql

type Query {
  listWithErrors: [QueryListWithErrorsResult!]!
}

union QueryListWithErrorsResult = Error | QueryListWithErrorsSuccess

type QueryListWithErrorsSuccess {
  data: [QueryListWithErrorsItemResult!]!
}

union QueryListWithErrorsItemResult = Error | QueryListWithErrorsItemSuccess

type QueryListWithErrorsItemSuccess {
  data: Int!
}
```

### Custom error union fields

Use `t.errorUnionField` and `t.errorUnionListField` to directly specify all members of the returned union type,
including multiple success types and error types.

```typescript
const CreateResult = builder.objectRef<{ id: string; created: true }>('CreateResult').implement({
  isTypeOf: (obj) => 'created' in obj,
  fields: (t) => ({
    id: t.exposeString('id'),
    created: t.exposeBoolean('created'),
  }),
});

const UpdateResult = builder.objectRef<{ id: string; updated: true }>('UpdateResult').implement({
  isTypeOf: (obj) => 'updated' in obj,
  fields: (t) => ({
    id: t.exposeString('id'),
    updated: t.exposeBoolean('updated'),
  }),
});

builder.mutationType({
  fields: (t) => ({
    modifyUser: t.errorUnionField({
      types: [CreateResult, UpdateResult, ValidationError],
      resolve: (parent, { action, name }) => {
        if (name.length < 3) return new ValidationError('Name too short');
        if (action === 'create') return { id: '123', created: true };
        return { id: '123', updated: true };
      },
    }),
    processUsers: t.errorUnionListField({
      types: [CreateResult, UpdateResult, ValidationError],
      resolve: (parent, { operations }) =>
        operations.map(op =>
          op.invalid ? new ValidationError('Invalid') :
          op.action === 'create' ? { id: op.id, created: true } :
          { id: op.id, updated: true }
        ),
    }),
  }),
});
```

#### Type resolution

Union members are resolved using standard Pothos type resolution. You have three options:

**Class-based types** (most error types) - automatically resolved via `instanceof` checks:
```typescript
class ValidationError extends Error { ... }
builder.objectType(ValidationError, { name: 'ValidationError', fields: ... });
// No isTypeOf needed - uses instanceof ValidationError
```

**`isTypeOf` function** - for plain object types:
```typescript
const CreateResult = builder.objectRef<{ id: string }>('CreateResult').implement({
  isTypeOf: (obj) => 'created' in obj,
  fields: ...
});
```

**Custom `resolveType` on union** - for complex resolution logic:
```typescript
t.errorUnionField({
  types: [CreateResult, UpdateResult, ValidationError],
  union: {
    resolveType: (value) => {
      if (value instanceof ValidationError) return 'ValidationError';
      if ('created' in value) return 'CreateResult';
      return 'UpdateResult';
    },
  },
  resolve: ...
});
```

### Using `builder.errorUnion`

You can use `builder.errorUnion` to manually construct an error union type that can be used with any field.  Fields returning an error union will automatically handle returned or thrown errors.

```typescript
builder.objectType(NotFoundError, {
  name: 'NotFoundError',
  interfaces: [ErrorInterface],
});

builder.objectType(ValidationError, {
  name: 'ValidationError',
  interfaces: [ErrorInterface],
  isTypeOf: (value) => value instanceof ValidationError,
  fields: (t) => ({
    field: t.exposeString('field'),
  }),
});

const UserType = builder.objectRef<{ id: string; name: string }>('User').implement({
  isTypeOf: (obj) => 'id' in obj && 'name' in obj,
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
  }),
});

const UserResult = builder.errorUnion('UserResult', {
  types: [UserType, NotFoundError, ValidationError],
});

builder.queryField('getUser', (t) =>
  t.field({
    type: UserResult,
    args: { id: t.arg.string({ required: true }) },
    resolve: (_, { id }) => {
      // Handles thrown errors
      if (!id) throw new ValidationError('ID required', 'id');
      // Handles returned errors
      if (id === 'unknown') return new NotFoundError('User not found');

      return { id, name: 'User' };
    },
  })
);
```

#### Options

- `types`: Array of member types (object refs, error classes, etc.)
- `omitDefaultTypes`: Set to `true` to exclude `defaultTypes` from the builder options (default: `false`)
- `resolveType`: Optional custom resolve function. Called after the internal error map check.
- All other standard union type options are supported
