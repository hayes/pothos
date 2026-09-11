# Mocks plugin

Replace selected field resolvers when building a schema for tests or local development.
Mocks are configured per `toSchema()` call, so the same builder can produce mocked and unmocked schemas.

## Usage

### Install

```package-install
npm install --save @pothos/plugin-mocks
```

### Setup

```typescript
import SchemaBuilder from '@pothos/core';
import MocksPlugin from '@pothos/plugin-mocks';
const builder = new SchemaBuilder({
  plugins: [MocksPlugin],
});
```

### Adding mocks

You can mock any field by adding a mock in the options passed to `builder.toSchema` under
`mocks.{typeName}.{fieldName}`.

```typescript
builder.queryType({
  fields: (t) => ({
    greeting: t.string({
      resolve: () => {
        throw new Error('Not implemented');
      },
    }),
    untouched: t.string({ resolve: () => 'Original resolver' }),
  }),
});

export const schema = builder.toSchema({
  mocks: {
    Query: {
      greeting: () => 'Mock result!',
    },
  },
});
```

A mock resolver receives the usual `parent`, `args`, `context`, and `info` arguments. Configured
mocks replace their field resolvers whenever those fields execute; unlisted fields keep their
original resolvers. Without a `mocks` option, the original `greeting` resolver throws its error.
A schema can be built multiple times with different mocks.

### Adding mocks for subscribe functions

To add a mock for a subscriber you can nest the mocks for subscribe and resolve in an object.
Subscription execution uses GraphQL's `subscribe()` in a server or test:

```typescript
builder.subscriptionType({
  fields: (t) => ({
    someField: t.string({
      resolve: () => {
        throw new Error('Not implemented');
      },
      subscribe: () => {
        throw new Error('Not implemented');
      },
    }),
  }),
});

builder.toSchema({
  mocks: {
    Subscription: {
      someField: {
        resolve: (event) => event,
        subscribe: async function* () {
          yield 'First event';
          yield 'Second event';
        },
      },
    },
  },
});
```
