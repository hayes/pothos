# Prisma Plugin for Pothos

This plugin provides tighter integration with prisma, making it easier to define prisma based object
types, and helps solve n+1 queries for relations. It also has integrations for the relay plugin to
make defining nodes and connections easy and efficient.

This plugin is NOT required to use prisma with Pothos, but does make things a lot easier and more
efficient. See the [Using Prisma without a plugin](#using-prisma-without-a-plugin) section below for
more details.

---

## Features

- 🎨 Quickly define GraphQL types based on your Prisma models
- 🦺 Strong type-safety throughout the entire API
- 🤝 Automatically resolve relationships defined in your database
- 🎣 Automatic Query optimization efficiently load the specific data needed to resolve a query
  (solves common N+1 issues)
- 💅 Types and fields in GraphQL schema are not implicitly tied to the column names or type in your
  database.
- 🔀 Relay integration for defining nodes and connections that can be efficiently loaded.
- 📚 Supports multiple GraphQL models based on the same Database model
- 🧮 Count fields can easily be added to objects and connections

## Example

Here is a quick example of what an API using this plugin might look like. There is a more thorough
breakdown of what the methods and options used in the example below.

```typescript
// Create an object type based on a prisma model without providing any custom type information
builder.prismaObject('User', {
  // findUnique is explained more below, and is required to safely resolve queries in some edge cases
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    // expose fields from the database
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    bio: t.string({
      // automatically load the bio from the profile when this field is queried
      select: {
        profile: {
          select: {
            bio: true,
          },
        },
      },
      resolve: (user) => user.profile.bio, // user will be typed correctly to include the selected fields from above
    }),
    // Load posts as list field.  Posts will automatically be included the posts field is queried
    posts: t.relation('posts', {
      args: {
        oldestFirst: t.arg.boolean(),
      },
      // Define custom query options that are applied when loading the post relation
      query: (args, context) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
    }),
    // creates relay connection that handles pagination using prisma's built in cursor based pagination
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
    }),
  }),
});

// Create a relay node based a prisma model
builder.prismaNode('Post', {
  findUnique: (id) => ({ id }),
  id: { resolve: (post) => post.id },
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Define a field that issues an optimized prisma query
    me: t.prismaField({
      type: 'User',
      resolve: async (query, root, args, ctx, info) =>
        prisma.user.findUnique({
          // the `query` argument will add in `includes` or `selects` to resolve as much of the request in a single query as possible
          ...query,
          rejectOnNotFound: true,
          where: { id: ctx.userId },
        }),
    }),
  }),
});
```

Given this schema, you would be able to resolve a query like the following with a single prisma
query (which will still result in a few optimized SQL queries).

```graphql
query {
  me {
    email
    posts {
      title
      author {
        id
      }
    }
  }
}
```

A query like

```graphql
query {
  me {
    email
    posts {
      title
      author {
        id
      }
    }
    oldPosts: posts(oldestFirst: true) {
      title
      author {
        id
      }
    }
  }
}
```

Will result in 2 calls to prisma, one to resolve everything except `oldPosts`, and a second to
resolve everything inside `oldPosts`. Prisma can only resolve each relation once in a single query,
so we need a separate to handle the second `posts` relation. These additional queries will use the
`findUnique` defined for the parent type to create a new efficient query to load any conflicting
relations.

## Install

```bash
yarn add @pothos/plugin-prisma
```

## Setup

This plugin requires a little more setup than other plugins because it integrates with the prisma to
generate some types that help the plugin better understand your prisma schema. Previous versions of
this plugin used to infer all required types from the prisma client itself, but this resulted in a
poor dev experience because the complex types slowed down editors, and some more advanced use cases
could not be typed correctly.

### Add a the `pothos` generator to your prisma schema

```
generator pothos {
  provider = "prisma-pothos-types"
}
```

Now the types Pothos uses will be generated whenever you re-generate your prisma client. Run the
following command to re-generate the client and create the new types:

```sh
npx prisma generate
```

additional options:

- `clientOutput`: Where the generated code will import the PrismaClient from. The default is the
  full path of wherever the client is generated. If you are checking in the generated file, using
  `@prisma/client` is a good option.
- `output`: Where to write the generated types

Example with more options:

```
generator pothos {
  provider = "prisma-pothos-types"
  clientOutput = "@prisma/client"
  output = "./pothos-types.ts"
}
```

### Set up the builder

```typescript
import SchemaBuilder from '@pothos/core';
import { PrismaClient } from '@prisma/client';
import PrismaPlugin from '@pothos/plugin-prisma';
// This is the default location for the generator, but this can be customized as described above
// Using a type only import will help avoid issues with undeclared exports in esm mode
import type PrismaTypes from '@pothos/plugin-prisma/generated';

const prisma = new PrismaClient({});

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
  },
});
```

It is strongly recommended NOT to put your prisma client into `Context`. This will result in slower
type-checking and a laggy developer experience in VSCode. See
https://github.com/microsoft/TypeScript/issues/45405 for more details.

## Creating some types with `builder.prismaObject`

`builder.prismaObject` takes 2 arguments:

1. `name`: The name of the prisma model this new type represents
2. `options`: options for the type being created, this is very similar to the options for any other
   object type

```typescript
builder.prismaObject('User', {
  // Optional name for the object, defaults to the name of the prisma model
  name: 'PostAuthor',
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
  }),
});

builder.prismaObject('Post', {
  findUnique: (post) => ({ id: post.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
  }),
});
```

So far, this is just creating some simple object types. They work just like any other object type in
Pothos. They main advantage of this is that we get the type information without using object refs,
or needing imports from prisma client.

The `findUnique` option is described more below.

## Adding prisma fields to non-prisma objects (including Query and Mutation)

There is a new `t.prismaField` method which can be used to define fields that resolve to your prisma
types:

```typescript
builder.queryType({
  fields: (t) => ({
    me: t.prismaField({
      type: 'User',
      resolve: async (query, root, args, ctx, info) =>
        prisma.user.findUnique({
          ...query,
          rejectOnNotFound: true,
          where: { id: ctx.userId },
        }),
    }),
  }),
});
```

This method works just like th normal `t.field` method with a couple of differences:

1. The `type` option must contain the name of the prisma model (eg. `User` or `[User]` for a list
   field).
2. The `resolve` function has a new first argument `query` which should be spread into query prisma
   query. This will be used to load data for nested relationships.

You do not need to use this method, and the `builder.prismaObject` method returns an object ref than
can be used like any other object ref (with `t.field`), but using `t.prismaField` will allow you to
take advantage of more efficient queries.

The `query` object will contain an object with `include` or `select` options to pre-load data needed
to resolve nested parts of the current query. The included/selected fields are based on which fields
are being queried, and the options provided when defining those fields and types.

## Adding relations

You can add fields for relations using the `t.relation` method:

```typescript
builder.queryType({
  fields: (t) => ({
    me: t.prismaField({
      type: 'User',
      resolve: async (query, root, args, ctx, info) =>
        prisma.user.findUnique({
          ...query,
          rejectOnNotFound: true,
          where: { id: ctx.userId },
        }),
    }),
  }),
});

builder.prismaObject('User', {
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.relation('posts'),
  }),
});

builder.prismaObject('Post', {
  findUnique: (post) => ({ id: post.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});
```

`t.relation` defines a field that can be pre-loaded by a parent resolver. This will create something
like `{ include: { author: true }}` that will be passed as part of the `query` argument of a
`prismaField` resolver. If the parent is another `relation` field, the includes will become nested,
and the full relation chain will be passed to the `prismaField` that started the chain.

For example the query:

```graphql
query {
  me {
    posts {
      author {
        id
      }
    }
  }
}
```

the `me` `prismaField` would receive something like the following as its query parameter:

```ts
{
  include: {
    posts: {
      include: {
        author: true;
      }
    }
  }
}
```

This will work perfectly for the majority of queries. There are a number of edge cases that make it
impossible to resolve everything in a single query. When this happens the `findUnique` option is
used to ensure that everything is still loaded correctly, and split into as few efficient queries as
possible.

### Find Unique

The `findUnique` function will receive an instance of the prisma model the current type is defining,
and should return an object that will be passed as a `where` in a `prisma.findUnique`. Generally,
this will just be something like: `user => { id: user.id }` where `id` is the primary key for the
table.

When the prisma plugin encounters a query where the requirements for a field can not be satisfied,
it will call findUnique for the current prisma model, and include or select all properties that are
required for the fields that could not be resolved without an additional query.

The following are some edge cases that could cause an additional query to be necessary:

- The parent object was not loaded through a field defined with `t.prismaField`, or `t.relation`
- The root `prismaField` did not correctly spread the `query` arguments in is prisma call.`
- The query selects multiple fields that use the same relation with incompatible options (order,
  limit, or other filters)
- The query contains multiple aliases for the same relation field with different arguments in a way
  that results in different query options for the relation.
- A relation field has a query that is incompatible with the default includes of the parent object

All of the above should be relatively uncommon in normal usage, but the plugin ensures that these
types of edge cases are automatically handled when they do occur.

### Without Find Unique

This is generally _NOT RECOMMENDED_, but you can set `findUnique` to null for some prisma objects.
Doing this will prevent the plugin from resolving queries for conflicting relations. Because of
this, you will need to provide a `resolve` method when defining relations, and some other options
(like field level selects, described below) will not be available. This `resolve` method is _ONLY
CALLED AS A FALLBACK_ when the relation has not already been loaded. This means that you should not
apply any sorting or filtering to the relation queried in the resolve method. Instead used the
`query` option described in the next section

```typescript
builder.prismaObject('User', {
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts', {
      resolve: (query, user) =>
        db.post.findMany({
          ...query,
          where: { authorId: user.id },
        }),
    }),
  }),
});
```

### Filters, Sorting, and arguments

So far we have been describing very simple queries without any arguments, filtering, or sorting. For
`t.prismaField` definitions, you can add arguments to your field like normal, and pass them into
your prisma query as needed. For `t.relation` the flow is slightly different because we are not
making a prisma query directly. We do this by adding a `query` option to our field options. Query
can either be a query object, or a method that returns a query object based on the field arguments.

```typescript
builder.prismaObject('User', {
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts', {
      // We can define arguments like any other field
      args: {
        oldestFirst: t.arg.boolean(),
      },
      // Then we can generate our query conditions based on the arguments
      query: (args, context) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
    }),
  }),
});
```

The returned query object will be added to the include section of the `query` argument that gets
passed into the first argument of the parent `t.prismaField`, and can include things like `where`,
`skip`, `take`, abd `orderBy`. The `query` function will be passed the arguments for the field, and
the context for the current request. Because it is used for pre-loading data, and solving n+1
issues, it can not be passed the `parent` object because it may not be loaded yet.

If your field has a `resolve` method the generated `query` will be passed in as part of the first
arg to your resolve function

```typescript
builder.prismaObject('User', {
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.relation('posts', {
      // We can define arguments like any other field
      args: {
        oldestFirst: t.arg.boolean(),
      },
      // Then we can generate our query conditions based on the arguments
      query: (args, context) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
      // optional: query here will contain the orderBy (and any other properties returned by the query method)
      resolve: (query, post) => db.post.findMany({ ...query, where: { id: post.authorId } }),
    }),
  }),
});
```

It is _VERY IMPORTANT_ to put all your filtering and sorting into the query method rather than your
resolver because the resolver is only used as fallback, and any filtering that does not exist in the
query method will not be applied correctly. If you have a where in both your query and your
resolver, you will need to ensure these are merged correctly. It is generally better NOT to use a
custom resolver.

## relationCount

Prisma supports querying for
[relation counts](https://www.prisma.io/docs/concepts/components/prisma-client/aggregation-grouping-summarizing#count-relations)
which allow including counts for relations along side other `includes`. This does not currently
support any filters on the counts, but can give a total count for a relation.

```typescript
builder.prismaObject('User', {
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    postCount: t.relationCount('posts'),
  }),
});
```

## Includes on types

In some cases, you may want to always pre-load certain relations. This can be helpful for defining
fields directly on type where the underlying data may come from a related table.

```typescript
builder.prismaObject('User', {
  // This will always include the profile when a user object is loaded.  Deeply nested relations can
  // also be included this way.
  include: {
    profile: true,
  },
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    bio: t.string({
      // The profile relation will always be loaded, and user will now be typed to include the
      // profile field so you can return the bio from the nested profile relation.
      resolve: (user) => user.profile.bio,
    }),
  }),
});
```

## Select mode for types

By default, the prisma plugin will use `include` when including relations, or generating fallback
queries. This means we are always loading all columns of a table when loading it in a
`t.prismaField` or a `t.relation`. This is usually what we want, but in some cases, you may want to
select specific columns instead. This can be useful if you have tables with either a very large
number of columns, or specific columns with large payloads you want to avoid loading.

To do this, you can add a `select` instead of an include to your `prismaObject`:

```typescript
builder.prismaObject('User', {
  select: {
    id: true,
  },
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
  }),
});
```

At the very least, you will need to `select` the properties required by your `findUnique` function.
The `t.expose*` and `t.relation` methods will all automatically add selections for the exposed
fields _WHEN THEY ARE QUERIED_, ensuring that only the requested columns will be loaded from the
database.

In addition to the `t.expose` and `t.relation`, you can also add custom selections to other fields:

```typescript
builder.prismaObject('User', {
  select: {
    id: true,
  },
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    bio: t.string({
      // This will select user.profile.bio when the the `bio` field is queried
      select: {
        profile: {
          select: {
            bio: true,
          },
        },
      },
      resolve: (user) => user.profile.bio,
    }),
  }),
});
```

## Type variants

The prisma plugin supports defining multiple GraphQL types based on the same prisma model.
Additional types are called `variants`. You will always need to have a "Primary" variant (defined as
described above). Additional variants can be defined by providing a `variant` option instead of a
`name` option when creating the type:

```typescript
const Viewer = builder.prismaObject('User', {
  variant: 'Viewer',
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
});
```

You can define variant fields that reference one variant from another:

```typescript
const Viewer = builder.prismaObject('User', {
  variant: 'Viewer',
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    // Using the model name ('User') will reference the primary variant
    user: t.variant('User'),
  });
});

const User = builder.prismaNode('User', {
  // Testing that user is typed correctly
  authScopes: (user) => !!user.id,
  interfaces: [Named],
  id: {
    resolve: (user) => user.id,
  },
  fields: (t) => ({
    // To reference another variant, use the returned object Ref instead of the model name:
    viewer: t.variant(Viewer, {}),
    email: t.exposeString('email'),
  }),
});
```

You can also use variants when defining relations by providing a `type` option:

```typescript
const PostDraft = builder.prismaNode('Post', {
  variant: 'PostDraft'
  // This is used to load the node by id
  findUnique: (id) => ({ id }),
  // This is used to get the id from a node
  id: { resolve: (post) => post.id },
  // fields work just like they do for builder.prismaObject
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});

const Viewer = builder.prismaObject('User', {
  variant: 'Viewer',
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    drafts: t.relation('posts', {
      // This will cause this relation to use the PostDraft variant rather than the default Post variant
      type: PostDraft,
      query: { where: { draft: true } },
    }),
  });
});
```

## Relay integration

This plugin has extensive integration with the
[relay plugin](https://pothos-graphql.dev/docs/plugins/relay), which makes creating nodes and
connections very easy.

### `prismaNode`

The `prismaNode` method works just like the `prismaObject` method with a couple of small
differences:

- the `findUnique` function now only receives an id. This is to support relays ability to load nodes
  by id.
- there is a new `id` option that mirrors the `id` option from `node` method of the relay plugin,
  and must contain a resolve function that returns the id from an instance of the node.

```typescript
builder.prismaNode('Post', {
  // This is used to load the node by id
  findUnique: (id) => ({ id }),
  // This is used to get the id from a node
  id: { resolve: (post) => post.id },
  // fields work just like they do for builder.prismaObject
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});
```

### `prismaConnection`

The `prismaConnection` method on a field builder can be used to create a relay `connection` field
that also pre-loads all the data nested inside that connection.

```typescript
builder.queryType({
  fields: (t) => ({
    posts: t.prismaConnection(
      {
        type: 'Post',
        cursor: 'id',
        resolve: (query, parent, args, context, info) => prisma.post.findMany({ ...query }),
      }),
      {}, // optional options for the Connection type
      {}, // optional options for the Edge type),
    ),
  }),
});
```

#### options

- `type`: the name of the prisma model being connected to
- `cursor`: a `@unique` column of the model being connected to. This is used as the `cursor` option
  passed to prisma.
- `defaultSize`: (default: 20) The default page size to use if `first` and `last` are not provided.
- `maxSize`: (default: 100) The maximum number of nodes returned for a connection.
- `resolve`: Like the resolver for `prismaField`, the first argument is a `query` object that should
  be spread into your prisma query. The `resolve` function should return an array of nodes for the
  connection. The `query` will contain the correct `take`, `skip`, and `cursor` options based on the
  connection arguments (`before`, `after`, `first`, `last`), along with `include` options for nested
  selections.

The created connection queries currently support the following combinations of connection arguments:

- `first`, `last`, or `before`
- `first` and `before`
- `last` and `after`

Queries for other combinations are not as useful, and generally requiring loading all records
between 2 cursors, or between a cursor and the end of the set. Generating query options for these
cases is more complex and likely very inefficient, so they will currently throw an Error indicating
the argument combinations are not supported.

### `relatedConnection`

The `relatedConnection` method can be used to create a relay `connection` field based on a relation
of the current model.

```typescript
builder.prismaNode('User', {
  findUnique: (id) => ({ id }),
  id: { resolve: (user) => user.id },
  fields: (t) => ({
    // Connections can be very simple to define
    simplePosts: t.relatedConnection('posts', {
      cursor: 'id',
    }),
    // Or they can include custom arguments, and other options
    posts: t.relatedConnection(
      'posts',
      {
        cursor: 'id',
        args: {
          oldestFirst: t.arg.boolean(),
        },
        query: (args, context) => ({
          orderBy: {
            createdAt: args.oldestFirst ? 'asc' : 'desc',
          },
        }),
      },
      {}, // optional options for the Connection type
      {}, // optional options for the Edge type),
    ),
  }),
});
```

#### options

- `cursor`: a `@unique` column of the model being connected to. This is used as the `cursor` option
  passed to prisma.
- `defaultSize`: (default: 20) The default page size to use if `first` and `last` are not provided.
- `maxSize`: (default: 100) The maximum number of nodes returned for a connection.
- `query`: A method that accepts the `args` and `context` for the connection field, and returns
  filtering and sorting logic that will be merged into the query for the relation.
- `resolve`: (optional) Used as a fallback when a connection is not pre-loaded. It is optional, and
  generally should NOT be defined manually. If used it works like a combination of the `resolve`
  method of `relation` and `prismaConnection`. The default will use the `findUnique` of the current
  model, with an `include` for the current relation. It is also batched together with other
  relationships to improve query efficiency.
- `totalCount`: when set to true, this will add a `totalCount` field to the connection object. see
  `relationCount` above for more details.

## Using Prisma without a plugin

Using prisma without a plugin is relatively straight forward using the `builder.objectRef` method.

The easiest way to create types backed by prisma looks something like:

```typescript
import { Post, PrismaClient, User } from '@prisma/client';

const db = new PrismaClient();
const UserObject = builder.objectRef<User>('User');
const PostObject = builder.objectRef<Post>('Post');

UserObject.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.field({
      type: [PostObject],
      resolve: (user) =>
        db.post.findMany({
          where: { authorId: user.id },
        }),
    }),
  }),
});

PostObject.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.field({
      type: UserObject,
      resolve: (post) =>
        db.user.findUnique({ rejectOnNotFound: true, where: { id: post.authorId } }),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.field({
      type: UserObject,
      resolve: (root, args, ctx) =>
        db.user.findUnique({ rejectOnNotFound: true, where: { id: ctx.userId } }),
    }),
  }),
});
```

This sets up User, and Post objects with a few fields, and a `me` query that returns the current
user. There are a few things to note in this setup:

1. We split up the `builder.objectRef` and the `implement` calls, rather than calling
   `builder.objectRef(...).implement(...)`. This prevents typescript from getting tripped up by the
   circular references between posts and users.
2. We use rejectOnNotFound with our `findUnique` calls because those fields are not nullable.
   Without this option, prisma will return a null if the object is not found. An alternative is to
   mark these fields as nullable.
3. The refs to our object types are called `UserObject` and `PostObject`, this is because `User` and
   `Post` are the names of the types imported from prisma. We could instead alias the types when we
   import them so we can name the refs to our GraphQL types after the models.

This setup is fairly simple, but it is easy to see the n+1 issues we might run into. Prisma helps
with this by batching queries together, but there are also things we can do in our implementation to
improve things.

One thing we could do if we know we will usually be loading the author any time we load a post is to
make the author part of shape required for a post:

```typescript
const UserObject = builder.objectRef<User>('User');
// We add the author here in the objectRef
const PostObject = builder.objectRef<Post & { author: User }>('Post');

UserObject.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.field({
      type: [PostObject],
      resolve: (user) =>
        db.post.findMany({
          // We now need to include the author when we query for posts
          include: {
            author: true,
          },
          where: { authorId: user.id },
        }),
    }),
  }),
});

PostObject.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.field({
      type: UserObject,
      // Now we can just return the author from the post instead of querying for it
      resolve: (post) => post.author,
    }),
  }),
});
```

We may not always want to query for the author though, so we could make the author optional and fall
back to using a query if it was not provided by the parent resolver:

```typescript
const PostObject = builder.objectRef<Post & { author?: User }>('Post');

PostObject.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.field({
      type: UserObject,
      resolve: (post) =>
        post.author ?? db.user.findUnique({ rejectOnNotFound: true, where: { id: post.authorId } }),
    }),
  }),
});
```

With this setup, a parent resolver has the option to include the author, but we have a fallback
incase it does not.

There are other patterns like dataloaders than can be used to reduce n+1 issues, and make your graph
more efficient, but they are too complex to describe here.
