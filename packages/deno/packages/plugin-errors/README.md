# Errors Plugin

A plugin for easily including errors in your GraphQL schema.

## Usage

### Install

```bash
yarn add @giraphql/plugin-errors
```

### Example Ussage

```typescript
import ErrorsPlugin from '@giraphql/plugin-errors';
const builder = new SchemaBuilder({
  plugins: [ErrorsPlugin],
  errorOptions: {
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
        type: [Error],
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

union QueryExtendedErrorListOrError = Error | QueryHelloSuccess

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

### Options on Fields

- `types`: An array of Error classes to catch and handle as error objects in the schema. Will be
  merged with `defaultTypes` from builder.
- `union`: An options object for the union type. Can include any normal union type options, and
  `name` option for setting a custom name for the union type.
- `result`: An options object for result object type. Can include any normal object type options,
  and `name` option for setting a custom name for the result type.
- `dataField`: An options object for the data field on the result object. This field will be named
  `data` by default, but can be written by passsing a custom `name` option.

### Recommended Ussage

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
import ErrorsPlugin from '@giraphql/plugin-errors';
const builder = new SchemaBuilder({
  plugins: [ErrorsPlugin],
  errorOptions: {
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
  isTypeOf: (obj) => obj instanceof Error,
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
  isTypeOf: (obj) => obj instanceof LengthError,
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
