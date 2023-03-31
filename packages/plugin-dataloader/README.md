# Dataloader Plugin

This plugin makes it easy to add fields and types that are loaded through a dataloader.

## Usage

### Install

To use the dataloader plugin you will need to install both the `dataloader` package and the Pothos
dataloader plugin:

```bash
yarn add dataloader @pothos/plugin-dataloader
```

### Setup

```typescript
import DataloaderPlugin from '@pothos/plugin-dataloader';

const builder = new SchemaBuilder({
  plugins: [DataloaderPlugin],
});
```

### loadable objects

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

It is **VERY IMPORTANT** to return values from `load` in an order that exactly matches the order of
the requested IDs. The order is used to map results to their IDs, and if the results are returned in
a different order, your GraphQL requests will end up with the wrong data. Correctly sorting results
returned from a database or other data source can be tricky, so there this plugin has a `sort`
option (described below) to simplify the sorting process. For more details on how the load function
works, see the [dataloader docs](https://github.com/graphql/dataloader#batch-function).

When defining fields that return `User`s, you will now be able to return either a `string` (based in
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
      resolve: (_root, args, context) => [...args.ids, context.CurrentUser],
    }),
  }),
});
```

Pothos will detect when a resolver returns `string`, `number`, or `bigint` (typescript will
constrain the allowed types to whatever is expected by the load function). If a resolver returns an
object instead, Pothos knows it can skip the dataloader for that object.

### loadable fields

In some cases you may need more granular dataloaders. To handle these cases there is a new
`t.loadable` method for defining fields with their own dataloaders.

```typescript
// Normal object that the fields below will load
interface PostShape {
  id: string;
  title: string;
  content: string;
}

const Post = builder.objectRef<PostShape>('Post').implement({
  fields: (t) => ({
    id: t.exposeID('id', {}),
    title: t.exposeString('title', {}),
    content: t.exposeString('title', {}),
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
    load: (ids: number[], context) => context.postsByUserIds(ids),
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
for the current request. dataloaders are not shared across requests, so we need the context to get
the correct dataloader for the current request:

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
may also return results in that format if your loader can have parital failures. GraphQL does not
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

First you'll need to update the types for your context type:

```typescript
import { LoadableRef } from '@pothos/plugin-dataloader';

export interface ContextType {
  userLoader: DataLoader<string, { id: number }>; // expose a specific loader
  getLoader: <K, V>(ref: LoadableRef<K, V, ContextType>) => DataLoader<K, V>; // helper to get a loader from a ref
  load: <K, V>(ref: LoadableRef<K, V, ContextType>, id: K) => Promise<V>; // helper for loading a single resource
  loadMany: <K, V>(ref: LoadableRef<K, V, ContextType>, ids: K[]) => Promise<(Error | V)[]>; // helper for loading many
  // other context fields
}
```

next you'll need to update your context factory function. The exact format of this depends on what
graphql server implementation you are using.

```typescript
import { initContextCache } from '@pothos/core';
import { LoadableRef, rejectErrors } from '@pothos/plugin-dataloader';

export const createContext = (req, res): ContextType => ({
  // Adding this will prevent any issues if you server implementation
  // copies or extends the context object before passing it to your resolvers
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
      rejectErrors(ref.getDataloader(this).loadMany(ids));
  },
});
```

Now you can use these helpers from your context object:

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
    resolve: (root, args, { loadMany }) => loadMany(User, ['123', '456']),
  }),
}));
```

### Using with the Relay plugin

If you are using the Relay plugin, there is an additional method `loadableNode` that gets added to
the builder. You can use this method to create `node` objects that work like other loadeble objects.

```typescript
const UserNode = builder.loadableNode('UserNode', {
  id: {
    resolve: (user) => user.id,
  },
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  fields: (t) => ({}),
});
```

### Loadable Refs and Circular references

You may run into type errors if you define 2 loadable objects that circularly reference each other
in their definitions.

There are a some general strategies to avoid this outlined in the
[circular-references guide](../guide/circular-references).

This plug also has methods for creating refs (similar to `builder.objectRef`) that can be used to
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
  isTypeOf: (obj) => obj instanceof User,
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
other that also allow you to define object types with additional behaviors.

### Caching resources loaded manually in a resolver

When manually loading a resource in a resolver it is not automatically added to the dataloader
cache. If you want any resolved value to be stored in the cache in case it is used somewhere else in
the query you can use the `cacheResolved` option.

The `cacheResolved` option takes a function that converts the loaded object into it's cache Key:

```typescript
const User = builder.loadableObject('User', {
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  cacheResolved: user => user.id,
  fields: (t) => ({
    id: t.exposeID('id', {}),
    ...
  }),
});
```

Whenever a resolver returns a User or list or Users, those objects will automatically be added the
dataloaders cache, so they can be re-used in other parts of the query.

### Sorting results from your `load` function

As mentioned above, the `load` function must return results in the same order as the provided array
of IDs. Doing this correctly can be a little complicated, so this plugin includes an alternative.
For any type or field that creates a dataloader, you can also provide a `sort` option which will
correctly map your results into the correct order based on their ids. To do this, you will need to
provide a function that accepts a result object, and returns its id.

```typescript
const User = builder.loadableObject('User', {
  load: (ids: string[], context: ContextType) => context.loadUsersById(ids),
  sort: user => user.id,
  fields: (t) => ({
    id: t.exposeID('id', {}),
    ...
  }),
});
```

This will also work with loadable nodes, interfaces, unions, or fields.

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
    ...
  }),
});
```
