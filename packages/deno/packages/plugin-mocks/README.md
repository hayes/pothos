# Mocks Plugin for GiraphQL

A simple plugin for adding resolver mocks to a graphQL schema.

## Usage

### Install

```bash
yarn add @giraphql/plugin-mocks
```

### Setup

```typescript
import MocksPlugin from '@giraphql/plugin-mocks';
const builder = new SchemaBuilder({
  plugins: [MocksPlugin],
});
```

### Adding mocks

You can mock any field by adding a mock in the options passed to `builder.builSchema` under
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

Mocks will replace the resolve functions any time a mocked field is executed. A schema can be build
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
        resolve: (parent, args, context, info) => 'Mock result!',
        subscribe: (parent, args, context, info) => {
          /* return a mock async iterator */
        },
      },
    },
  },
});
```
