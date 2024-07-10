# Relay Plugin

The Relay plugin adds a number of builder methods and helper functions to simplify building a relay
compatible schema.

## Usage

### Install

```bash
yarn add @pothos/plugin-relay
```

### Setup

```typescript
import RelayPlugin from '@pothos/plugin-relay';
const builder = new SchemaBuilder({
  plugins: [RelayPlugin],
  relay: {},
});
```

### Options

The `relay` options object passed to builder can contain the following properties:

- `idFieldName`: The name of the field that contains the global id for the node. Defaults to `id`.
- `idFieldOptions`: Options to pass to the id field.
- `clientMutationId`: `omit` (default) | `required` | `optional`. Determines if clientMutationId
  fields are created on `relayMutationFields`, and if they are required.
- `cursorType`: `String` | `ID`. Determines type used for cursor fields. Defaults to `String`
- `nodeQueryOptions`: Options for the `node` field on the query object, set to false to omit the
  field
- `nodesQueryOptions`: Options for the `nodes` field on the query object, set to false to omit the
  field
- `nodeTypeOptions`: Options for the `Node` interface type
- `pageInfoTypeOptions`: Options for the `TypeInfo` object type
- `clientMutationIdFieldOptions`: Options for the `clientMutationId` field on connection objects
- `clientMutationIdInputOptions`: Options for the `clientMutationId` input field on connections
  fields
- `mutationInputArgOptions`: Options for the Input object created for each connection field
- `cursorFieldOptions`: Options for the `cursor` field on an edge object.
- `nodeFieldOptions`: Options for the `node` field on an edge object.
- `edgesFieldOptions`: Options for the `edges` field on a connection object.
- `pageInfoFieldOptions`: Options for the `pageInfo` field on a connection object.
- `hasNextPageFieldOptions`: Options for the `hasNextPage` field on the `PageInfo` object.
- `hasPreviousPageFieldOptions`: Options for the `hasPreviousPage` field on the `PageInfo` object.
- `startCursorFieldOptions`: Options for the `startCursor` field on the `PageInfo` object.
- `endCursorFieldOptions`: Options for the `endCursor` field on the `PageInfo` object.
- `beforeArgOptions`: Options for the `before` arg on a connection field.
- `afterArgOptions`: Options for the `after` arg on a connection field.
- `firstArgOptions`: Options for the `first` arg on a connection field.
- `lastArgOptions`: Options for the `last` arg on a connection field.
- `defaultConnectionTypeOptions`: Default options for the `Connection` Object types.
- `defaultEdgeTypeOptions`: Default options for the `Edge` Object types.
- `defaultPayloadTypeOptions`: Default options for the `Payload` Object types.
- `defaultMutationInputTypeOptions`: default options for the mutation `Input` types.
- `nodesOnConnection`: If true, the `nodes` field will be added to the `Connection` object types.
- `defaultConnectionFieldOptions`: Default options for connection fields defined with t.connection
- `brandLoadedObjects`: Defaults to `true`. This will add a hidden symbol to objects returned from
  the `load` methods of Nodes that allows the default `resolveType` implementation to identify the
  type of the node. When this is enabled, you will not need to implement an `isTypeOf` check for
  most common patterns.

### Creating Nodes

To create objects that extend the `Node` interface, you can use the new `builder.node` method.

```typescript
// Using object refs
const User = builder.objectRef<UserType>('User');
// Or using a class
class User {
  id: string;
  name: string;
}

builder.node(User, {
  // define an id field
  id: {
    resolve: (user) => user.id,
    // other options for id field can be added here
  },

  // Define only one of the following methods for loading nodes by id
  loadOne: (id) => loadUserByID(id),
  loadMany: (ids) => loadUsers(ids),
  loadWithoutCache: (id) => loadUserByID(id),
  loadManyWithoutCache: (ids) => loadUsers(ids),

  // if using a class instaed of a ref, you will need to provide a name
  name: 'User',
  fields: (t) => ({
    name: t.exposeString('name'),
  }),
});
```

`builder.node` will create an object type that implements the `Node` interface. It will also create
the `Node` interface the first time it is used. The `resolve` function for `id` should return a
number or string, which will be converted to a globalID. The relay plugin adds to new query fields
`node` and `nodes` which can be used to directly fetch nodes using global IDs by calling the
provided `loadOne` or `loadMany` method. Each node will only be loaded once by id, and cached if the
same node is loaded multiple times inn the same request. You can provide `loadWithoutCache` or
`loadManyWithoutCache` instead if caching is not desired, or you are already using a caching
datasource like a dataloader.

Nodes may also implement an `isTypeOf` method which can be used to resolve the correct type for
lists of generic nodes. When using a class as the type parameter, the `isTypeOf` method defaults to
using an `instanceof` check, and falls back to checking the constructor property on the prototype.
The means that for many cases if you are using classes in your type parameters, and all your values
are instances of those classes, you won't need to implement an `isTypeOf` method, but it is usually
better to explicitly define that behavior.

By default (unless `brandLoadedObjects` is set to `false`) any nodes loaded through one of the
`load*` methods will be branded so that the default `resolveType` method can identify the GraphQL
type for the loaded object. This means `isTypeOf` is only required for `union` and `interface`
fields that return node objects that are manually loaded, where the union or interface does not have
a custom `resolveType` method that knows how to resolve the node type.

#### parsing node ids

By default all node ids are parsed as string. This behavior can be customized by providing a custom
parse function for your node's ID field:

```ts
const User = builder.objectRef<UserType>('User')
builder.node(User, {
  // define an id field
  id: {
    resolve: (user) => user.id,
    parse: (id) => Number.parseInt(id, 10),
  },
  // the ID is now a number
  loadOne: (id) => loadUserByID(id),
  ...
});
```

### Global IDs

To make it easier to create globally unique ids the relay plugin adds new methods for creating
globalID fields.

```typescript
import { encodeGlobalID } from '@pothos/plugin-relay';

builder.queryFields((t) => ({
  singleID: t.globalID({
    resolve: (parent, args, context) => {
      return { id: 123, type: 'SomeType' };
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

There are also new methods for adding globalIDs in arguments or fields of input types:

```typescript
builder.queryType({
  fields: (t) => ({
    fieldThatAcceptsGlobalID: t.boolean({
      args: {
        id: t.arg.globalID({
          required: true,
        }),
        idList: t.arg.globalIDList(),
      },
      resolve(parent, args) {
        console.log(`Get request for type ${args.id.typename} with id ${args.id.id}`);
        return true;
      },
    }),
  }),
});
```

globalIDs used in arguments expect the client to send a globalID string, but will automatically be
converted to an object with 2 properties (`id` and `typename`) before they are passed to your
resolver in the arguments object.

#### Limiting global ID args to specific types

`globalID` input's can be configured to validate the type of the globalID. This is useful if you
only want to accept IDs for specific node types.

```typescript
builder.queryType({
  fields: (t) => ({
    fieldThatAcceptsGlobalID: t.boolean({
      args: {
        id: t.arg.globalID({
          for: SomeType,
          // or allow multiple types
          for: [TypeOne, TypeTwo],
          required: true,
        }),
      },
    }),
  }),
});
```

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
        return {
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: 'abc',
            endCursor: 'def',
          },
          edges: [
            {
              cursor: 'abc',
              node: new NumberThing(123),
            },
            {
              cursor: 'def',
              node: new NumberThing(123),
            },
          ],
        };
      },
    },
    {
      name: 'NameOfConnectionType', // optional, will use ParentObject + capitalize(FieldName) + "Connection" as the default
      fields: (tc) => ({
        // define extra fields on Connection
        // We need to use a new variable for the connection field builder (eg tc) to get the correct types
      }),
      edgesField: {}, // optional, allows customizing the edges field on the Connection Object
      // Other options for connection object can be added here
    },
    {
      // Same as above, but for the Edge Object
      name: 'NameOfEdgeType', // optional, will use Connection name + "Edge" as the default
      fields: (te) => ({
        // define extra fields on Edge
        // We need to use a new variable for the connection field builder (eg te) to get the correct types
      }),
      nodeField: {}, // optional, allows customizing the node field on the Edge Object
    },
  ),
}));
```

Manually implementing connections can be cumbersome, so there are a couple of helper methods that
can make resolving connections a little easier.

For limit/offset based apis:

```typescript
import { resolveOffsetConnection } from '@pothos/plugin-relay';

builder.queryFields((t) => ({
  things: t.connection({
    type: SomeThing,
    resolve: (parent, args) => {
      return resolveOffsetConnection({ args }, ({ limit, offset }) => {
        return getThings(offset, limit);
      });
    },
  }),
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
import { resolveArrayConnection } from '@pothos/plugin-relay';

builder.queryFields((t) => ({
  things: t.connection({
    type: SomeThings,
    resolve: (parent, args) => {
      return resolveArrayConnection({ args }, getAllTheThingsAsArray());
    },
  }),
}));
```

Cursor based pagination can be implemented using the `resolveCursorConnection` method. The following
example uses prisma, but a similar solution should work with any data store that supports limits,
ordering, and filtering.

```typescript
import { resolveCursorConnection, ResolveCursorConnectionArgs } from '@pothos/plugin-relay';

builder.queryField('posts', (t) =>
  t.connection({
    type: Post,
    resolve: (_, args) =>
      resolveCursorConnection(
        {
          args,
          toCursor: (post) => post.createdAt.toISOString(),
        },
        // Manually defining the arg type here is required
        // so that typescript can correctly infer the return value
        ({ before, after, limit, inverted }: ResolveCursorConnectionArgs) =>
          prisma.post.findMany({
            take: limit,
            where: {
              createdAt: {
                lt: before,
                gt: after,
              },
            },
            orderBy: {
              createdAt: inverted ? 'desc' : 'asc',
            },
          }),
      ),
  }),
);
```

### Relay Mutations

You can use the `relayMutationField` method to define relay compliant mutation fields. This method
will generate a mutation field, an input object with a `clientMutationId` field, and an output
object with the corresponding `clientMutationId`.

Example ussage:

```typescript
builder.relayMutationField(
  'deleteItem',
  {
    inputFields: (t) => ({
      id: t.id({
        required: true,
      }),
    }),
  },
  {
    resolve: async (root, args, ctx) => {
      if (ctx.items.has(args.input.id)) {
        ctx.items.delete(args.input.id);

        return { success: true };
      }

      return { sucess: false };
    },
  },
  {
    outputFields: (t) => ({
      sucess: t.boolean({
        resolve: (result) => result.success,
      }),
    }),
  },
);
```

Which produces the following graphql types:

```graphql
input DeleteItemInput {
  clientMutationId: ID!
  id: ID!
}

type DeleteItemPayload {
  clientMutationId: ID!
  itWorked: Boolean!
}

type Mutation {
  deleteItem(input: DeleteItemInput!): DeleteItemPayload!
}
```

The `relayMutationField` has 4 arguments:

- `name`: Name of the mutation field
- `inputOptions`: Options for the `input` object or a ref to an existing input object
- `fieldOptions`: Options for the mutation field
- `payloadOptions`: Options for the Payload object

The `inputOptions` has a couple of non-standard options:

- `name` which can be used to set the name of the input object
- `argName` which can be used to overwrite the default arguments name (`input`).

The `payloadOptions` object also accepts a `name` property for setting the name of the payload
object.

You can also access refs for the created input and payload objects so you can re-use them in other
fields:

```typescript
// Using aliases when destructuring lets you name your refs rather than using the generic `inputType` and `payloadType`
const { inputType: DeleteItemInput, payloadType: DeleteItemPayload } = builder.relayMutationField(
  'deleteItem',
  ...
);
```

### Reusing connection objects

In some cases you may want to create a connection object type that is shared by multiple fields. To
do this, you will need to create the connection object separately and then create a fields using a
ref to your connection object:

```typescript
import { resolveOffsetConnection } from '@pothos/plugin-relay';

const ThingsConnection = builder.connectionObject(
  {
    // connection options
    type: SomeThing,
    name: 'ThingsConnection',
  },
  {
    // Edge options (optional)
    name: 'ThingsEdge', // defaults to Appending `Edge` to the Connection name
  },
);

// You can use connection object with normal fields
builder.queryFields((t) => ({
  things: t.field({
    type: ThingsConnection,
    args: {
      ...t.arg.connectionArgs(),
    },
    resolve: (parent, args) => {
      return resolveOffsetConnection({ args }, ({ limit, offset }) => {
        return getThings(offset, limit);
      });
    },
  }),
}));

// Or by providing the connection type when creating a connection field
builder.queryFields((t) => ({
  things: t.connection({
    resolve: (parent, args) => {
      return resolveOffsetConnection({ args }, ({ limit, offset }) => {
        return getThings(offset, limit);
      });
    },
  }),
  ThingsConnection,
}));
```

`builder.connectionObject` creates the connect object type and the associated Edge type.
`t.arg.connectionArgs()` will create the default connection args.

### Reusing edge objects

Similarly you can directly create and re-use edge objects

```typescript
import { resolveOffsetConnection } from '@pothos/plugin-relay';

const ThingsEdge = builder.edgeObject(
  {
    name: 'ThingsEdge',
    type: SomeThing,
  },
);

// The edge object can be used when creating a connection object
const ThingsConnection = builder.connectionObject(
  {
    type: SomeThing,
    name: 'ThingsConnection',
  },
  ThingsEdge,
);

// Or when creating a connection field
builder.queryFields((t) => ({
  things: t.connection({
    resolve: (parent, args) => {
      return resolveOffsetConnection({ args }, ({ limit, offset }) => {
        return getThings(offset, limit);
      });
    },
  }),
  {
    // connection options
  },
  ThingsEdge,
}));


```

`builder.connectionObject` creates the connect object type and the associated Edge type.
`t.arg.connectionArgs()` will create the default connection args.

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

### decoding and encoding global ids

The relay plugin exports `decodeGlobalID` and `encodeGlobalID` as helper methods for interacting
with global IDs directly. If you accept a global ID as an argument you can use the `decodeGlobalID`
function to decode it:

```typescript
builder.mutationFields((t) => ({
  updateThing: t.field({
    type: Thing,
    args: {
      id: t.args.id({ required: true }),
      update: t.args.string({ required: true }),
    },
    resolve(parent, args) {
      const { type, id } = decodeGlobalID(args.id);

      const thing = Thing.findById(id);

      thing.update(args.update);

      return thing;
    },
  }),
}));
```

### Using custom encoding for global ids

In some cases you may want to encode global ids differently than the build in ID encoding. To do
this, you can pass a custom encoding and decoding function into the relay options of the builder:

```typescript
import RelayPlugin from '@pothos/plugin-relay';
const builder = new SchemaBuilder({
  plugins: [RelayPlugin],
  relayOptions: {
    encodeGlobalID: (typename: string, id: string | number | bigint) => `${typename}:${id}`,
    decodeGlobalID: (globalID: string) => {
      const [typename, id] = globalID.split(':');

      return { typename, id };
    },
  },
});
```

### Using custom resolve for node and or nodes field

If you need to customize how nodes are loaded for the `node` and or `nodes` fields you can provide
custom resolve functions in the builder options for these fields:

```typescript
import RelayPlugin from '@pothos/plugin-relay';

function customUserLoader({ id, typename }: { id: string; typename: string }) {
  // load user
}

const builder = new SchemaBuilder({
  plugins: [RelayPlugin],
  relayOptions: {
    nodeQueryOptions: {
      resolve: (root, { id }, context, info, resolveNode) => {
        // use custom loading for User nodes
        if (id.typename === 'User') {
          return customUserLoader(id);
        }

        // fallback to normal loading for everything else
        return resolveNode(id);
      },
    },
    nodesQueryOptions: {
      resolve: (root, { ids }, context, info, resolveNodes) => {
        return ids.map((id) => {
          if (id.typename === 'User') {
            return customNodeLoader(id);
          }

          // it would be more efficient to load all the nodes at once
          // but it is important to ensure the resolver returns nodes in the right order
          // we are resolving nodes one at a time here for simplicity
          return resolveNodes([id]);
        });
      },
    },
  },
});
```

### Extending all connections

There are 2 builder methods for adding fields to all connection objects: `t.globalConnectionField`
and `t.globalConnectionFields`. These methods work like many of the other methods on the builder for
adding fields to objects or interfaces.

```typescript
builder.globalConnectionField('totalCount', (t) =>
  t.int({
    nullable: false,
    resolve: (parent) => 123,
  }),
);
// Or
builder.globalConnectionFields((t) => ({
  totalCount: t.int({
    nullable: false,
    resolve: (parent) => 123,
  }),
}));
```

In the above example, we are just returning a static number for our `totalCount` field. To make this
more useful, we need to have our resolvers for each connection actually return an object that
contains a totalCount for us. To guarantee that resolvers correctly implement this behavior, we can
define custom properties that must be returned from connection resolvers when we set up our builder:

```typescript
import RelayPlugin from '@pothos/plugin-relay';
const builder = new SchemaBuilder<{
  Connection: {
    totalCount: number;
  };
}>({
  plugins: [RelayPlugin],
  relayOptions: {},
});
```

Now typescript will ensure that objects returned from each connection resolver include a totalCount
property, which we can use in our connection fields:

```typescript
builder.globalConnectionField('totalCount', (t) =>
  t.int({
    nullable: false,
    resolve: (parent) => parent.totalCount,
  }),
);
```

Note that adding additional required properties will make it harder to use the provided connection
helpers since they will not automatically return your custom properties. You will need to manually
add in any custom props after getting the result from the helpers:

```typescript
builder.queryFields((t) => ({
  posts: t.connection({
    type: Post,
    resolve: (parent, args, context) => {
      const postsArray = context.Posts.getAll();
      const result = resolveArrayConnection({ args }, postsArray);

      return result && { totalCount: postsArray.length, ...result };
    },
  }),
}));
```

### Changing nullability of edges and nodes

If you want to change the nullability of the `edges` field on a `Connection` or the `node` field on
an `Edge` you can configure this in 2 ways:

#### Globally

```typescript
import RelayPlugin from '@pothos/plugin-relay';
const builder = new SchemaBuilder<{
  DefaultEdgesNullability: false;
  DefaultNodeNullability: true;
}>({
  plugins: [RelayPlugin],
  relayOptions: {
    edgesFieldOptions: {
      nullable: false,
    },
    nodeFieldOptions: {
      nullable: true,
    },
  },
});
```

The types provided for `DefaultEdgesNullability` and `DefaultNodeNullability` must match the values
provided in the nullable option of `edgesFieldOptions` and `nodeFieldOptions` respectively. This
will set the default nullability for all connections created by your builder.

nullability for `edges` fields defaults to `{ list: false, items: true }` and the nullability of
`node` fields default to `false`.

#### Per connection

```typescript
builder.queryFields((t) => ({
  things: t.connection({
    type: SomeThings,
    edgesNullable: {
      items: true,
      list: false,
    },
    nodeNullable: false,
    resolve: (parent, args) => {
      return resolveOffsetConnection({ args }, ({ limit, offset }) => {
        return getThings(offset, limit);
      });
    },
  }),
}));
// Or

const ThingsConnection = builder.connectionObject({
  type: SomeThing,
  name: 'ThingsConnection',
  edgesNullable: {
    items: true,
    list: false,
  },
  nodeNullable: false,
});
```
