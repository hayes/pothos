---
name: Dataloader
menu: Plugins
---

# Dataloader Plugin

This plugin makes it easy to add fields and types that are loaded through a dataloader.

## Usage

### Install

To use the dataloader plugin you will need to install both the `dataloader` package and the
validation plugin:

```bash
yarn add dataloader @giraphql/plugin-dataloader
```

### Setup

```typescript
import DataloaderPlugin from '@giraphql/plugin-dataloader';

const builder = new SchemaBuilder({
  plugins: [DataloaderPlugin],
});
```

### loadable objects

To create an object type that can be loaded with a dataloader use the new `builder.loadableObject`
method:

```ts
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

When defining fields that return `User`s, you will now be able to return either a `string` (based in
ids param of `load`), or a User object (type based on the return type of `loadUsersById`).

```ts
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

GiraphQL will detect when a resolver returns `string`, `number`, or `bigint` (typescript will
constrain the allowed types to whatever is expected by the load function). If a resolver returns an
object instead, GiraphQL knows it can skip the dataloader for that object.

### loadable fields

In some cases you may need more granular dataloaders. To handle these cases there is a new
`t.loadable` method for defining fields with their own dataloaders.

```ts
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

### dataloader options

You can provide additional options for your dataloaders using `loaderOptions`.

```ts
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

```ts
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
have special handling for Error objects. Instead GiraphQL will map these results to something like
`(Type | Promise<Type>)[]` where Errors are replaced with promises that will be rejected. This
allows the normal graphql resolver flow to correctly handle these errors.

If you are using the `loadMany` method from a dataloader manually, you can apply the same mapping
using the `rejectErrors` helper:

```ts
import { rejectErrors } from '@giraphql/plugin-dataloader';

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

```ts
import { LoadableRef } from '@giraphql/plugin-dataloader';

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

```ts
import { initContextCache } from '@giraphql/core';
import { LoadableRef, rejectErrors } from '@giraphql/plugin-dataloader';

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

```ts
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
