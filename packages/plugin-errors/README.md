# Errors Plugin

A plugin for easily including error types in your GraphQL schema and hooking up error types to
resolvers

## Usage

### Install

```bash
yarn add @pothos/plugin-errors
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
  `data` by default, but can be written by passsing a custom `name` option.
- `directResult`: Boolean, can only be set to true for non-list fields. This will directly include
  the fields type in the union rather than creating an intermediate Result object type. This will
  throw at build time if the type is not an object type.

### Recommended Usage

1. Set up an Error interface
2. Create a BaseError object type
3. Include the Error interface in any custom Error types you define
4. Include the BaseError type in the `defaultTypes` in the builder config

This pattern will allow you to consistently query your schema using a `... on Error { message }`
fragment since all Error classes extend that interface. If your client want's to query details of
more specialized error types, they can just add a fragment for the errors it cares about. This
pattern should also make it easier to make future changes without unexpected breaking changes for
your clients.

The follow is a small example of this pattern:

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

To use this in combination with the validation plugin, ensure that that errors plugin is listed
BEFORE the validation plugin in your plugin list.

Once your plugins are set up, you can define types for a ZodError, the same way you would for any
other error type. Below is a simple example of how this can be done, but the specifics of how you
structure your error types are left up to you.

```typescript
// Util for flattening zod errors into something easier to represent in your Schema.
function flattenErrors(
  error: ZodFormattedError<unknown>,
  path: string[],
): { path: string[]; message: string }[] {
  // eslint-disable-next-line no-underscore-dangle
  const errors = error._errors.map((message) => ({
    path,
    message,
  }));

  Object.keys(error).forEach((key) => {
    if (key !== '_errors') {
      errors.push(
        ...flattenErrors((error as Record<string, unknown>)[key] as ZodFormattedError<unknown>, [
          ...path,
          key,
        ]),
      );
    }
  });

  return errors;
}

// A type for the individual validation issues
const ZodFieldError = builder
  .objectRef<{
    message: string;
    path: string[];
  }>('ZodFieldError')
  .implement({
    fields: (t) => ({
      message: t.exposeString('message'),
      path: t.exposeStringList('path'),
    }),
  });

// The actual error type
builder.objectType(ZodError, {
  name: 'ZodError',
  interfaces: [ErrorInterface],
  fields: (t) => ({
    fieldErrors: t.field({
      type: [ZodFieldError],
      resolve: (err) => flattenErrors(err.format(), []),
    }),
  }),
});

builder.queryField('fieldWIthValidation', (t) =>
  t.boolean({
    errors: {
      types: [ZodError],
    },
    args: {
      string: t.arg.string({
        validate: {
          type: 'string',
          minLength: 3,
        },
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
    ... on ZodError {
      fieldErrors {
        message
        path
      }
    }
  }
}
```

### With the dataloader plugin

To use this in combination with the dataloader plugin, ensure that that errors plugin is listed
BEFORE the validation plugin in your plugin list.

If a field with `errors` returns a `loadableObject`, or `loadableNode` the errors plugin will now
catch errors thrown when loading ids returned by the `resolve` function.

If the field is a `List` field, errors that occur when resolving objects from `ids` will not be
handled by the errors plugin. This is because those errors are associated with each item in the list
rather than the list field itself. In the future, the dataloader plugin may have an option to throw
an error at the field level if any items can not be loaded, which would allow the error plugin to
handle these types of errors.

### With the prisma plugin

To use this in combination with the prisma plugin, ensure that that errors plugin is listed BEFORE
the validation plugin in your plugin list. This will enable `errors` option to work work correctly
with any field builder method from the prisma plugin.

`errors` can be configured for any field, but if there is an error pre-loading a relation the error
will always surfaced at the field that executed the query. Because there are cases that fall back to
executing queries for relation fields, these fields may still have errors if the relation was not
pre-loaded. Detection of nested relations will continue to work if those relations use the `errors`
plugin
