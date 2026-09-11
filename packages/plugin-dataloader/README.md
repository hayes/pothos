# Dataloader Plugin

The dataloader plugin batches loads for fields and object types. Resolvers return record keys,
and the plugin loads those records through a DataLoader shared within the request. This reduces
repeated database calls when a query selects the same relation for many objects.

## Run batching and caching

This companion uses three in-memory users. Run `01-batching`: the requested keys are
`["3", "1", "3", "missing"]`, but `batchKeys` contains only `["3", "1", "missing"]`.
The duplicate key shares its load, `cachedAgain` confirms that a later load adds no batch,
and the returned users keep the requested order. The missing user is `null` because this
example permits nullable list items.

```typescript
const User = builder.loadableObject('User', {
  load: async (ids: string[], context: Context) => {
    context.batches ??= [];
    context.batches.push([...ids]);
    // This source deliberately returns storage order, not requested order.
    return users.filter((user) => ids.includes(user.id));
  },
  sort: (user) => user.id,
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
  }),
});
```

The source returns storage order deliberately. `sort` maps each record back to its requested
key. The companion also has a `users` field whose resolver returns only keys; run
`02-key-resolvers` to see the plugin load those records automatically.

```typescript
    batching: t.field({
      type: BatchReport,
      args: { ids: t.arg.stringList({ required: true }) },
      resolve: async (_parent, { ids }, context) => {
        const loader = User.getDataloader(context);
        const loaded = await Promise.all(ids.map((id) => loader.load(id)));
        const before = context.batches?.length ?? 0;
        if (ids.length) {
          await loader.load(ids[0]);
        }
        return {
          users: loaded,
          batchKeys: context.batches ?? [],
          cachedAgain: (context.batches?.length ?? 0) === before,
        };
      },
    }),
```

Change the first operation's keys to `["2", "1", "2"]`: expect Grace, Ada, Grace, and one batch
containing only `"2"` and `"1"`. Each run receives a fresh context, so caches do not cross
requests. The report awaits its loads before returning its counters; a sibling query field
would not reliably observe completed batches. This small source makes batching visible without
a database; the data access and relation alternatives below apply to real request loaders.

## Usage

### Install

To use the dataloader plugin you will need to install both the `dataloader` package and the Pothos
dataloader plugin:

```package-install
npm install --save dataloader @pothos/plugin-dataloader
```

### Setup

```typescript
import SchemaBuilder from '@pothos/core';
import DataloaderPlugin from '@pothos/plugin-dataloader';

type UserShape = {
  id: string;
  username: string;
  lastPostID: number;
  postIDs: number[];
};

type ContextType = {
  currentUser: UserShape;
  loadUsersById: (ids: string[]) => Promise<UserShape[]>;
};

const builder = new SchemaBuilder<{ Context: ContextType }>({
  plugins: [DataloaderPlugin],
});
```

### loadable objects

Later examples that redefine `User` replace this definition; choose the options needed by your
application. They are not additional declarations in the same schema.

To create an object type that can be loaded with a dataloader use the new `builder.loadableObject`
method:

```typescript
const User = builder.loadableObject('User', {
  // load will be called with ids of users that need to be loaded
  // Note that the types for keys (and context if present) are required
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  fields: (t) => ({
    id: t.exposeID('id', {}),
    username: t.string({
      // the shape of parent will be inferred from `loadUsersById()` above
      resolve: (parent) => parent.username,
    }),
  }),
});
```

Return one value from `load` for each requested ID, in the same order. The order is used to map results to their IDs, and if the results are returned in
a different order, your GraphQL requests will end up with the wrong data. Correctly sorting results
returned from a database or other data source can be tricky, so this plugin has a `sort`
option (described below) to simplify the sorting process. For more details on how the load function
works, see the [dataloader docs](https://github.com/graphql/dataloader#batch-function).

When defining fields that return `User`s, you will now be able to return either a `string` (based on the
ids param of `load`), or a User object (type based on the return type of `loadUsersById`).

```typescript
builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: User,
      args: {
        id: t.arg.string({ required: true }),
      },
      // Here we can just return the ID directly rather than loading the user ourselves
      resolve: (root, args) => args.id,
    }),
    currentUser: t.field({
      type: User,
      // If we already have the user, we use it, and the dataloader will not be called
      resolve: (root, args, context) => context.currentUser,
    }),
    users: t.field({
      type: [User],
      args: {
        ids: t.arg.stringList({ required: true }),
      },
      // Mixing ids and user objects also works
      resolve: (_root, args, context) => [...args.ids, context.currentUser],
    }),
  }),
});
```

Pothos will detect when a resolver returns `string`, `number`, or `bigint` (typescript will
constrain the allowed types to whatever is expected by the load function). If a resolver returns an
object instead, Pothos knows it can skip the dataloader for that object.

### loadable fields

The relation examples below extend `ContextType` with the post-loading methods they call.
`loadPosts` returns one `PostShape` per post ID; `postsByUserIds` and `loadPostsByUserIds` return
one `PostShape[]` per user ID, preserving the requested ID order. Each `posts` definition is an
alternative for the same field. For the grouped variant, add
`postsForUserIds: (ids: string[]) => Promise<PostShape[]>` to `ContextType`; it returns a flat
list with `authorId` on each post.

In some cases you may need more granular dataloaders. To handle these cases there is a new
`t.loadable` method for defining fields with their own dataloaders.

```typescript
// Normal object that the fields below will load
interface PostShape {
  id: number;
  authorId: string;
  title: string;
  content: string;
}

const Post = builder.objectRef<PostShape>('Post').implement({
  fields: (t) => ({
    id: t.exposeID('id', {}),
    title: t.exposeString('title', {}),
    content: t.exposeString('content', {}),
  }),
});

// Loading a single Post
builder.objectField(User, 'latestPost', (t) =>
  t.loadable({
    type: Post,
    // will be called with ids of latest posts for all users in query
    load: (ids: number[], context) => context.loadPosts(ids),
    resolve: (user, args) => user.lastPostID,
  }),
);
// Loading multiple Posts
builder.objectField(User, 'posts', (t) =>
  t.loadable({
    type: [Post],
    // will be called with ids of posts loaded for all users in query
    load: (ids: number[], context) => context.loadPosts(ids),
    resolve: (user, args) => user.postIDs,
  }),
);
```

### loadableList fields for one-to-many relations

`loadable` fields can return lists, but do not work for loading a list of records from a single id.

The `loadableList` method can be used to define loadable fields that represent this kind of
relationship.

```typescript
// Loading multiple Posts
builder.objectField(User, 'posts', (t) =>
  t.loadableList({
    // type is singular, but will create a list field
    type: Post,
    // will be called with ids of all the users, and should return `Post[][]`
    load: (ids: string[], context) => context.postsByUserIds(ids),
    resolve: (user, args) => user.id,
  }),
);
```

### loadableGroup fields for one-to-many relations

In many cases, it's easier to load a flat list in a dataloader rather than loading a list of lists.
the `loadableGroup` method simplifies this.

```typescript
// Loading multiple Posts
builder.objectField(User, 'posts', (t) =>
  t.loadableGroup({
    // type is singular, but will create a list field
    type: Post,
    // will be called with ids of all the users, and should return `Post[]`
    load: (ids: string[], context) => context.postsForUserIds(ids),
    // will be called with each post to determine which group it belongs to
    group: (post) => post.authorId,
    resolve: (user, args) => user.id,
  }),
);
```

### Accessing args on loadable fields

By default the `load` method for fields does not have access to the fields arguments. This is
because the dataloader will aggregate the calls across different selections and aliases that may not
have the same arguments. To access the arguments, you can pass `byPath: true` in the fields options.
This will cause the dataloader to only aggregate calls for the same "path" in the query, meaning all
calls share the same arguments. This will allow you to access a 3rd `args` argument on the `load`
method.

```typescript
builder.objectField(User, 'posts', (t) =>
  t.loadableList({
    type: Post,
    byPath: true,
    args: {
      limit: t.arg.int({ required: true }),
    },
    load: (ids: string[], context, args) => context.loadPostsByUserIds(ids, args.limit),
    resolve: (user, args) => user.id,
  }),
);
```

### dataloader options

You can provide additional options for your dataloaders using `loaderOptions`.

```typescript
const User = builder.loadableObject('User', {
  loaderOptions: { maxBatchSize: 20 },
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  fields: (t) => ({ id: t.exposeID('id', {}) }),
});

builder.objectField(User, 'posts', (t) =>
  t.loadable({
    type: [Post],
    loaderOptions: { maxBatchSize: 20 },
    load: (ids: number[], context) => context.loadPosts(ids),
    resolve: (user, args) => user.postIDs,
  }),
);
```

See [dataloader docs](https://github.com/graphql/dataloader#api) for all available options.

### Manually using dataloader

Dataloaders for "loadable" objects can be accessed via their ref by passing in the context object
for the current request. Pass a fresh context object for each request so cached records are not
shared between users.
Reusing the context also reuses its loaders:

```typescript
// create loadable object
const User = builder.loadableObject('User', {
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});

builder.queryField('user', (t) =>
  t.field({
    type: User,
    resolve: (parent, args, context) => {
      // get data loader for User type
      const loader = User.getDataloader(context);

      // manually load a user
      return loader.load('123');
    },
  }),
);
```

### Errors

Calling dataloader.loadMany will resolve to a value like `(Type | Error)[]`. Your `load` function
may also return results in that format if your loader can have partial failures. GraphQL does not
have special handling for Error objects. Instead Pothos will map these results to something like
`(Type | Promise<Type>)[]` where Errors are replaced with promises that will be rejected. This
allows the normal graphql resolver flow to correctly handle these errors.

If you are using the `loadMany` method from a dataloader manually, you can apply the same mapping
using the `rejectErrors` helper:

```typescript
import { rejectErrors } from '@pothos/plugin-dataloader';

builder.queryField('user', (t) =>
  t.field({
    type: [User],
    resolve: (parent, args, context) => {
      const loader = User.getDataloader(context);

      return rejectErrors(loader.loadMany(['123', '456']));
    },
  }),
);
```

### (Optional) Adding loaders to context

If you want to make dataloaders accessible via the context object directly, there is some additional
setup required. Below are a few options for different ways you can load data from the context
object. You can determine which of these options works best for you or add you own helpers.

The following interface replaces `ContextType` from the setup; include its original fields as
well as the loader helpers:

```typescript
import DataLoader from 'dataloader';
import { LoadableRef } from '@pothos/plugin-dataloader';

export interface ContextType {
  currentUser: UserShape;
  loadUsersById: (ids: string[]) => Promise<UserShape[]>;
  userLoader: DataLoader<string, UserShape>; // expose a specific loader
  getLoader: <K, V>(ref: LoadableRef<K, V, ContextType>) => DataLoader<K, V>; // helper to get a loader from a ref
  load: <K, V>(ref: LoadableRef<K, V, ContextType>, id: K) => Promise<V>; // helper for loading a single resource
  loadMany: <K, V>(ref: LoadableRef<K, V, ContextType>, ids: K[]) => Promise<(Error | V)[]>; // helper for loading many
  // other context fields
}
```

Next you'll need to update your context factory function. The exact format of this depends on what
graphql server implementation you are using.

```typescript
import { initContextCache } from '@pothos/core';
import { rejectErrors } from '@pothos/plugin-dataloader';

export const createContext = (
  currentUser: UserShape,
  loadUsersById: ContextType['loadUsersById'],
): ContextType => ({
  currentUser,
  loadUsersById,
  // Preserve the cache when the server copies or extends the context.
  ...initContextCache(),

  // using getters allows us to access the context object using `this`
  get userLoader() {
    return User.getDataloader(this);
  },
  get getLoader() {
    return <K, V>(ref: LoadableRef<K, V, ContextType>) => ref.getDataloader(this);
  },
  get load() {
    return <K, V>(ref: LoadableRef<K, V, ContextType>, id: K) => ref.getDataloader(this).load(id);
  },
  get loadMany() {
    return <K, V>(ref: LoadableRef<K, V, ContextType>, ids: K[]) =>
      ref.getDataloader(this).loadMany(ids);
  },
});
```

Call `createContext` for each request with the authenticated user and that request's data access
function. You can then use these helpers from resolvers:

```typescript
builder.queryFields((t) => ({
  fromContext1: t.field({
    type: User,
    resolve: (root, args, { userLoader }) => userLoader.load('123'),
  }),
  fromContext2: t.field({
    type: User,
    resolve: (root, args, { getLoader }) => getLoader(User).load('456'),
  }),
  fromContext3: t.field({
    type: User,
    resolve: (root, args, { load }) => load(User, '789'),
  }),
  fromContext4: t.field({
    type: [User],
    resolve: (root, args, { loadMany }) => rejectErrors(loadMany(User, ['123', '456'])),
  }),
}));
```

### Using with the Relay plugin

Register both `DataloaderPlugin` and `RelayPlugin` and set `relay: {}` on the builder to use
`loadableNode`. You can use this method to create `node` objects that work like other loadable objects.

```typescript
const UserNode = builder.loadableNode('UserNode', {
  id: {
    resolve: (user) => user.id,
  },
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  fields: (t) => ({}),
});
```

#### Loadable connections

This example adds `loadFriendsByUserIds: (ids: string[]) => Promise<Record<string, UserShape[]>>`
to `ContextType`. Return an entry for every requested ID, with an empty array for users without
friends. The helper indexes that result by user ID before paginating each list.

To data-load a connection, you can use a combination of helpers:

- `builder.connectionObject` To create the connection and edge types
- `t.loadable` with the `byPath` option to create a loadable field with access to arguments
- `t.arg.connectionArgs` to add the standard connection arguments to the field

```typescript
import { resolveArrayConnection } from '@pothos/plugin-relay';

const UserFriendsConnection = builder.connectionObject({
  type: User,
  name: 'UserFriendsConnection',
});

builder.objectFields(User, (t) => ({
  friends: t.loadable({
    type: UserFriendsConnection,
    byPath: true,
    args: {
      ...t.arg.connectionArgs(),
    },
    load: async (ids: string[], context, args) => {
      // This implementation assumes you will load all friends for each user, and then filter them with `resolveArrayConnection`.
      // This may not be efficient in a large production system
      const friendsById = await context.loadFriendsByUserIds(ids);

      return ids.map((id) => {
        return resolveArrayConnection({ args }, friendsById[id]);
      });
    },
    resolve: (user) => user.id.toString(),
  }),
}));
```

### Loadable Refs and Circular references

You may run into type errors if you define 2 loadable objects that circularly reference each other
in their definitions.

There are a some general strategies to avoid this outlined in the
[circular-references guide](../guide/circular-references).

This plugin also has methods for creating refs (similar to `builder.objectRef`) that can be used to
split the definition and implementation of your types to avoid any issues with circular references.

```typescript
const User = builder.loadableObjectRef('User', {
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
});

User.implement({
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});

// Or with relay
const UserNode = builder.loadableNodeRef('UserNode', {
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  id: {
    resolve: (user) => user.id,
  },
});

UserNode.implement({
  fields: (t) => ({}),
});
```

All the plugin specific options should be passed when defining the ref. This allows the ref to be
used by any method that accepts a ref to implement an object:

```typescript
const User = builder.loadableObjectRef('User', {
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
});

builder.objectType(User, {
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});
```

The above example is not useful on its own, but this pattern will allow these refs to be used with
others that also allow you to define object types with additional behaviors.

### Caching resources loaded manually in a resolver

When manually loading a resource in a resolver it is not automatically added to the dataloader
cache. If you want any resolved value to be stored in the cache in case it is used somewhere else in
the query you can use the `cacheResolved` option.

The `cacheResolved` option takes a function that converts the loaded object into its cache key:

```typescript
const User = builder.loadableObject('User', {
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  cacheResolved: user => user.id,
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});
```

Whenever a resolver returns a User or list of Users, those objects will automatically be added to the
dataloaders cache, so they can be re-used in other parts of the query.

### Sorting results from your `load` function

As mentioned above, the `load` function must return results in the same order as the provided array
of IDs. Doing this correctly can be a little complicated, so this plugin includes an alternative.
For any type or field that creates a dataloader, you can also provide a `sort` option which will
correctly map your results into the correct order based on their ids. To do this, you will need to
provide a function that accepts a result object, and returns its id.

The batching companion deliberately returns records in storage order to demonstrate this mapping:

```typescript
const User = builder.loadableObject('User', {
  load: async (ids: string[], context: Context) => {
    context.batches ??= [];
    context.batches.push([...ids]);
    // This source deliberately returns storage order, not requested order.
    return users.filter((user) => ids.includes(user.id));
  },
  sort: (user) => user.id,
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
  }),
});
```

This also works with loadable nodes, interfaces, unions, and fields. Missing keys become `null`
after sorting. Choose field and list-item nullability to match that behavior; a missing record in
a non-null position produces a GraphQL error. Without `sort`, return one result for every key in
the same order, using `null` or an `Error` for missing records as appropriate for your loader.

When sorting, if the list of results contains an Error the error is thrown because it can not be
mapped to the correct location. This `sort` option should NOT be used for cases where the result
list is expected to contain errors.

### Shared `toKey` method.

Defining multiple functions to extract the key from a loaded object can become redundant. In cases
when you are using both `cacheResolved` and `sort` you can use a `toKey` function instead:

```typescript
const User = builder.loadableObject('User', {
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  toKey: user => user.id,
  cacheResolved: true,
  sort: true,
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});
```


### Subscriptions

Dataloaders are stored on the context object of the subscription.  This means that values are cached across the full lifetime of the subscription.

To reset all data loaders for the current subscription, you can use the `clearAllDataLoaders` helper.



```typescript
import { clearAllDataLoaders } from '@pothos/plugin-dataloader';

clearAllDataLoaders(context);
```
