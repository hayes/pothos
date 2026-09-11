# Mocks plugin

Replace selected field resolvers when building a schema for tests or local development.
Mocks are configured per `toSchema()` call, so the same builder can produce mocked and unmocked schemas.

## Run a mocked field

Run the query to see the selected resolver replaced while `untouched` still returns
`Original resolver`. Change `Mock result!` in the source, rebuild, and run again to see your fixture.
Remove the `mocks` option from `toSchema()` to surface the original `Not implemented` error.
Reset restores the original companion, including its mock.

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

The browser runner executes queries and mutations with `graphql()`; it does not consume live
subscriptions. The subscription example below belongs in a server or test using `subscribe()`.

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
    someField: t.string({
      resolve: () => {
        throw new Error('Not implemented');
      },
    }),
  }),
});

builder.toSchema({
  mocks: {
    Query: {
      someField: (parent, args, context, info) => 'Mock result!',
    },
  },
});
```

Mocks will replace the resolve functions any time a mocked field is executed. A schema can be built
multiple times with different mocks.

### Adding mocks for subscribe functions

To add a mock for a subscriber you can nest the mocks for subscribe and resolve in an object:

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
