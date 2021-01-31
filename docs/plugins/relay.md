---
name: Relay
menu: Plugins
---

# Relay Plugin

The Relay plugin adds a number of builder methods a helper functions to simplify building a relay
compatible schema.

## Usage

### Install

```bash
yarn add @giraphql/plugin-relay
```

### Setup

```typescript
import '@giraphql/plugin-relay';
const builder = new SchemaBuilder({
  plugins: ['GiraphQLRelay'],
  relayOptions: {
    nodeQueryOptions: {},
    nodesQueryOptions: {},
    nodeTypeOptions: {},
    pageInfoTypeOptions: {},
  },
});
```

The options objects here are required, but will often be empty. Like many other places in the
GiraphQL API, options objects are required because other plugins may contribute required options.
These options objects will enable things like defining auth policies for your node query fields if
you are using the auth plugin.

### Global ids

To make it easier to create globally unique ids the relay plugin adds new methods for creating
globalID fields.

```typescript
import { encodeGlobalID } from '@giraphql/plugin-relay';

builder.queryFields((t) => ({
  singleID: t.globalID({
    resolve: (parent, args, context) => {
      return encodeGlobalID('SomeType', 123);
    },
  }),
  listOfIDs: t.globalIDList({
    resolve: (parent, args, context) => {
      return [{ id: 123, type: 'SomeType' }];
    },
  }),
}));
```

The returned IDs can either be a string \(which is expected to already be a globalID\), or an object
with the an `id` and a `type`, The type can be either the name of a name as a string, or any object
that can be used in a type parameter.

### Creating Nodes

To create objects that extend the `Node` interface, you can use the new `builder.node` method.

```typescript
class NumberThing {
  id: number;

  binary: string;

  constructor(n: number) {
    this.id = n;
    this.binary = n.toString(2);
  }
}

builder.node(NumberThing, {
  id: {
    resolve: (num) => num.id,
    // other options for id field can be added here
  },
  loadOne: (id) => new NumberThing(parseInt(id)),
  loadMany: (ids) => ids.map((id) => new NumberThing(parseInt(id))),
  name: 'Number',
  fields: (t) => ({
    binary: t.exposeString('binary', {}),
  }),
});
```

`builder.node` will create an object type that implements the `Node` interface. It will also create
the `Node` interface the first time it is used. The `resolve` function for `id` should return a
number or string, which will be converted to a globalID. The `loadOne` and `loadMany` methods are
optional, and `loadMany` will be used if both are present. These methods allow a nodes to be loaded
by id. The relay plugin adds to new query fields `node` and `nodes` which can be used to directly
fetch nodes using global IDs.

Nodes may also implement an `isTypeOf` method which can be used to resolve the correct type for
lists of generic nodes. When using a class as the type parameter, the `isTypeOf` method defaults to
using an `instanceof` check, and falls back to checking the constructor property on the prototype.
The means that for many cases if you are using classes in your type parameters, and all your values
are instances of those classes, you won't need to implement an `isTypeOf` method, but it is ussually
better to explicitly define that behavior.

### Creating Connections

The `t.connection` field builder method can be used to define connections. This method will
automatically create the `Connection` and `Edge` objects used by the connection, and add `before`,
`after`, `first`, and `last` arguments. The first time this method is used, it will also create the
`PageInfo` type.

```typescript
builder.queryFields((t) => ({
  numbers: t.connection(
    {
      type: NumberThing,
      resolve: (parent, { first, last, before, after }) => {
        return resolveOffsetConnection({ args }, ({ limit, offset }) => {
          return {
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: 'abc',
              endCursor: 'def',
            },
            edges: [
              {
                cursor: 'xyz',
                node: new NumberThing(123),
              },
            ],
          };
        });
      },
    },
    {
      name: 'NameOfConnectionType', // optional, will use ParentObject + capitalize(FieldName) + "Connection" as the default
      fields: () => ({
        /* define extra fields on Connection */
      }),
      // Other options for connection object can be added here
    },
    {
      // Same as above, but for the Edge Object
      name: 'NameOfEdgeType', // optional, will use Connection name + "Edge" as the default
      fields: () => ({
        /* define extra fields on Edge */
      }),
    },
  ),
}));
```

Manually implementing connections can be cumbersome, so there are a couple of helper methods that
can make resolving connections a little easier.

For limit/offset based apis:

```typescript
import { resolveOffsetConnection } from '@giraphql/plugin-relay';

builder.queryFields((t) => ({
  numbers: t.connection(
    {
      type: SomeThings,
      resolve: (parent, args) => {
        return resolveOffsetConnection({ args }, ({ limit, offset }) => {
          return getThings(offset, limit);
        });
      },
    },
    {},
    {},
  ),
}));
```

`resolveOffsetConnection` has a few default limits to prevent unintentionally allowing too many
records to be fetched at once. These limits can be configure using the following options:

```typescript
{
  args: ConnectionArguments;
  defaultSize?: number; // defaults to 20
  maxSize?: number; // defaults to 100
}
```

For APIs where you have the full array available you can use `resolveArrayConnection`, which works
just like `resolveOffsetConnection` and accepts the same options.

```typescript
import { resolveArrayConnection } from '@giraphql/plugin-relay';

builder.queryFields((t) => ({
  numbers: t.connection(
    {
      type: SomeThings,
      resolve: (parent, args) => {
        return resolveOffsetConnection({ args }, getAllTheThingsAsArray());
      },
    },
    {},
    {},
  ),
}));
```

I am planning to add more helpers in the future.

### Expose nodes

The `t.node` and `t.nodes` methods can be used to add additional node fields. the expected return
values of `id` and `ids` fields is the same as the resolve value of `t.globalID`, and can either be
a globalID or an object with and an `id` and a `type`.

Loading nodes by `id` uses a request cache, so the same node will only be loaded once per request,
even if it is used multiple times across the schema.

```typescript
builder.queryFields((t) => ({
  extraNode: t.node({
    id: () => 'TnVtYmVyOjI=',
  }),
  moreNodes: t.nodeList({
    ids: () => ['TnVtYmVyOjI=', { id: 10, type: 'SomeType' }],
  }),
}));
```

### Using custom encoding for global ids

In some cases you may want to encode global ids differently than the build in ID encoding. To do
this, you can pass a custom encoding and decoding function into the relay options of the builder:

```typescript
import '@giraphql/plugin-relay';
const builder = new SchemaBuilder({
  plugins: ['GiraphQLRelay'],
  relayOptions: {
    nodeQueryOptions: {},
    nodesQueryOptions: {},
    nodeTypeOptions: {},
    pageInfoTypeOptions: {},
    encodeGlobalID: (typename: string, id: string | number | bigint) => `${typename}:${id}`,
    decodeGlobalID: (globalID: string) => {
      const [typename, id] = globalID.split(':');

      return { typename, id };
    },
  },
});
```
