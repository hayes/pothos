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
});
```

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

The returned IDs can either be a string (which is expected to already be a globalID), or an object
with the an `id` and a `type`, The type can be either the name of a name as a string, or any object
that can be used in a type paramiter.

### Creating Nodes

To create objects that extend the `Node` interface, you can use the new `builder.node` method.

```typescript
class NumberThing {
    __type = NumberThing;

    id: number;

    binary: string;

    constructor(n: number) {
        this.id = n;
        this.binary = n.toString(2);
    }
}

builder.node(NumberThing, {
    loadOne: (id) => new NumberThing(parseInt(id)),
    loadMany: (ids) => ids.map((id) => new NumberThing(parseInt(id))),
    name: 'Number',
    fields: (t) => ({
        binary: t.exposeString('binary', {}),
    }),
});
```

`builder.node` will create an object type that implements the `Node` interface. It will also create
the `Node` inerface the first time it is used. The first argument must be a reference to a type that
has an id field, and a `__type` fiield. The `__type` parameter should a be a reference to the type
being implemented, and can be a string or object that can be used as a type parameter.

The `loadOne` and `loadMany` methods are optional, and `loadMany` will be used if both are present.
These methods allow a nodes to be loaded by id. The relay plugin adds to new query fields `node` and
`nodes` which can be used to directly fetch nodes using global IDs.

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
