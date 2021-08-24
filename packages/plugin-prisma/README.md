# Prisma Plugin for GiraphQL

This plugin provides tighter integration with prisma, making it easier to define prisma bioased
object types, and helps solve n+1 queries for relations. It also has integrations for the relay
plugin to make defining nodes and connections easy and efficient.

## Disclaimers

This plugin is experimental, and will have some breaking changes in the future. DO NOT USE this
plugin unless you are willing to deal with breaking changes in upcoming versions. This plugin may
introduce BREAKING changes in minor versions until it's major version has been increased above 0.

This plugin is NOT required to build graphs backed by prisma models, and I would not recommend using
it unless you have a solid understanding of how it will construct queries.

This plugin will allow common queries to be resolved through a single prisma query (prisma may still
turn this into multiple SQL queries), and provides reasonable, predictable and safe fallbacks for
more complex queries and edge cases. That being said, graphql APIs are complex, and it is important
to understand the queries your API is capable of executing.

The way this plugin resolves queries is designed to be efficient, while still being predictable and
easy to understand. Tools that try to automatically generate queries are often hard to understand
and reason about, so this plugin tries to make things as clear as possible by providing query
options to resolvers and a loading user code to initiate the actual queries. The options generally
only contain `include`s for nested relations (connection fields provide more complex query options).
The exception to this, is that we provide a default resolver for relations that can handle querying
for a relation if data was not pre-loaded by a parent field. This query used by this resolver is
simple, and described in detail below.

With this simple approach, we get an API that is easy to understand, but still provides a lot of
value and functionality.

## Example

Here is a quick example of what an API using this plugin might look like. There is a more thorough
breakdown of what the methods and options used in the example below.

If you are looking for an example integrated with the
[relay plugin](https://giraphql.com/plugins/relay), see the [Relay integration](#relay-integration)
section below.

```typescript
builder.prismaObject('User', {
  include {
    profile: true,
  },
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    bio: t.string({
      resolve: user => user.profile.bio,
    }),
    posts: t.relation('posts', {
      args: {
        oldestFirst: t.arg.boolean(),
      },
      query: (args, context) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
    }),
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
so we need a separate to handle the second `posts` relation. This may seem slightly magical, but
should be predictable and hopefully easy to understand after reading the documentation below.

## GiraphQL + Prisma without a plugin

If you just want learn about the plugin, feel free to skip this section, but understanding how to
use prisma without a plugin may be useful for evaluating if this plugin is a good fit for your use
case.

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

## Usage

### Install

```bash
yarn add @giraphql/plugin-prisma
```

### Setup

This plugin requires a little more setup than other plugins because it integrates with the prisma to
generate some types that help the plugin better understand your prisma schema. Previous versions of
this plugin used to infer all required types from the prisma client itself, but this resulted in a
poor dev experience because the complex types slowed down editors, and some more advanced use cases
could not be typed correctly.

#### Add a the giraphql generator to your prisma schema

```
generator giraphql {
  provider = "prisma-giraphql-types"
}
```

additional options:

- `clientOutput`: Where the generated code will import the PrismaClient from. The default is the
  full path of wherever the client is generated. If you are checking in the generated file, using
  `@prisma/client` is a good option.
- `output`: Where to write the generated types

Example with more options:

```
generator giraphql {
  provider = "prisma-giraphql-types"
  clientOutput = "@prisma/client"
  output = "./giraphql-types.ts"
}
```

#### Set up the builder

```typescript
import SchemaBuilder from '@giraphql/core';
import { PrismaClient } from '@prisma/client';
import PrismaPlugin, { PrismaTypes } from '@giraphql/plugin- prisma';
// This is the default location for the generator, but this can be customized as described above
import PrismaTypes from '@giraphql/plugin-prisma/generated';

const prisma = new PrismaClient({});

const builder = new SchemaBuilder<{
  PrismaTypes;
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

### Creating some types with `builder.prismaObject`

`builder.prismaObject` takes 2 arguments:

1. `name`: The name of the prisma model this new type represents
2. `options`: options for the type being created, this is very similar to the options for any other
   object type

```typescript
builder.prismaObject('User', {
  // Optional name for the object, defaults to the name of the prisma model
  name: 'PostAuthor',
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
  }),
});

builder.prismaObject('Post', {
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
  }),
});
```

So far, this is just creating some simple object types. They work just like any other object type in
GiraphQL. They main advantage of this is that we get the type information without using object refs,
or needing imports from prisma client.

The `findUnique` option is described more below.

### Adding prisma fields to non-prisma objects (including Query and Mutation)

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

The `query` object will contain an `include` object to pre-load data needed to resolve nested parts
of the current query. This is based on fields defined with `t.relation` described below.

If there are no fields using `t.relation` in your query, everything is resolved exactly as it would
be without this plugin.

### Adding relations

You can add fields for relations using the `t.relation` method:

```typescript
builder.prismaObject('User', {
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.relation('posts', {
      resolve: (query, user) =>
        db.post.findMany({
          ...query,
          where: { authorId: user.id },
        }),
    }),
  }),
});

builder.prismaObject('User', {
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author', {
      resolve: (query, post) =>
        db.user.findUnique({ ...query, rejectOnNotFound: true, where: { id: post.authorId } }),
    }),
  }),
});
```

`t.relation` defines a field that can be pre-loaded by a parent resolver, and most of the time, the
`resolve` function will NOT be called. This is VERY IMPORTANT to understand, because it is the
biggest place where you can introduce inconsistencies into your API with this plugin. The `resolve`
function is used to load the relationship if parent resolver did not pre-load the data needed to
resolve the field. This happens for a number of reasons:

1. The parent object was not loaded through a field defined with `t.prismaField`, or `t.relation`
2. The `query` object for the parent field was not spread into the query
3. The graphql query requested multiple fields that depended on the same relationship (described
   more below)

These are all okay, and expected situations. Graphql APIs are very flexible, and magically pushing
everything into a single query is impossible for arbitrary queries. This is why we have a `resolve`
function than can load the relation IF it was not already loaded by the parent.

Like `t.prismaField`, the `resolve` function now as a new first argument that is a query that should
be spread into the query, and is used to load nested relationships.

### Find Unique

Because the `resolve` function is only used as a fallback, it is harder to test, and if done
incorrectly can introduce inconsistencies. While it shouldn't be too hard to get right, it might be
better to avoid it entirely. To do this, we can let the Prisma plugin generate these resolve
functions for you in a consistent and predictable way. We can do this by providing a findUnique
option for our object type. Defining a `findUnique` that is not null, will make `resolve` optional.

```typescript
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

This greatly simplifies our object types. In these cases, the fallback resolve functions will
re-load the current object using the `findUnique` as the where clause, and then `include` the
relation for the current field. This can produce a slightly less efficient query than a manual
implementation because the parent object is re-loaded first, but it will batch multiple
relationships into one query, and the findUnique queries should be very fast.

For example, if a `User` was loaded without pre-loading, and both a `posts` and a `profile` relation
where requested, the generated prisma call would be something like:

```typescript
prisma.user.findUnique({
  rejectOnNotFound: true,
  where: { id: user.id },
  include: {
    posts: true,
    profile: true,
  },
});
```

### Filters, Sorting, and arguments

So far we have been describing very simple queries without any arguments, filtering, or sorting. For
`t.prismaField` definitions, you can add arguments to your field like normal, and pass them into
your prisma query as needed. For `t.relation` the flow is slightly different because we need to make
sure we are loading the right data if we are pre-loading data in a parent resolver. We do this by
adding a `query` option to our field options.

```typescript
builder.prismaObject('User', {
  findUnique: (user) => ({ id: user.id }),
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
    }),
  }),
});
```

This query will be part of the `query` that gets passed into the first argument of `resolve`
function for `t.relation` and `t.prismaField` based fields, and include things like `where`, `skip`,
`take`, `orderBy`, etc. The `query` function will be passed the arguments for the field, and the
context for the current request. Because it is used for pre-loading data, and solving n+1 issues, it
can not be passed the `parent` object because it may not be loaded yet.

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
      // query here will contain the orderBy (and any other properties returned by the query method)
      resolve: (query, post) => db.post.findMany({ ...query, where: { id: post.authorId } }),
    }),
  }),
});
```

It is VERY IMPORTANT to put all your filtering and sorting into the query method rather than your
resolver because the resolver is only used as fallback, and any filtering that does not exist in the
query method will not be applied correctly. If you have a where in both your query and your
resolver, you will need to ensure these are merged correctly. It is generally better NOT to use a
custom resolver.

### Includes on types

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

### relationCount

Prisma recently introduced
[Relation counts](https://www.prisma.io/docs/concepts/components/prisma-client/aggregation-grouping-summarizing#count-relations)
which allow including counts for relations along side other `includes`. This feature is still behind
a flag and has some bugs.

Support for defining count fields has been added to this plugin, but is not currently recommend due
to an outstand prisma bug that causes queries to fail when a count include is nested inside a list
relation. Until [this bug](https://github.com/prisma/prisma/issues/8861) is fixed this feature
SHOULD NOT BE USED.

```typescript
builder.prismaObject('User', {
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    postCount: t.relationCount('posts'),
  }),
});
```

## Relay integration

This plugin has extensive integration with the [relay plugin](https://giraphql.com/plugins/relay),
which makes creating nodes and connections very easy.

### Example

The following example is similar to the one above with a few changes:

- the `User` and `Post` objects are now relay nodes
- the `posts` field on the `User` type is now a relay connection using cursor based pagination
- there is a new `users` query that is also a relay connection

Everything in this schema is still queryable via a single prisma query. The relay connections
handles pre-loading like all the other fields.

```typescript
builder.prismaNode('User', {
  findUnique: (id) => ({ id }),
  id: { resolve: (user) => user.id },
  fields: (t) => ({
    email: t.exposeString('email'),
    posts: t.relatedConnection('posts', {
      cursor: 'id',
      args: {
        oldestFirst: t.arg.boolean(),
      },
      query: (args, context) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
    }),
  }),
});

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
    me: t.prismaField({
      type: 'User',
      resolve: async (query, root, args, ctx, info) =>
        prisma.user.findUnique({
          ...query,
          rejectOnNotFound: true,
          where: { id: ctx.userId },
        }),
    }),
    posts: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      resolve: (query) => prisma.post.findMany(query),
    }),
  }),
});
```

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
- `resolve`: (optional) Used as a fallback when a connection is not pre-loaded. It is optional, and
  generally should NOT be defined manually. If used it works like a combination of the `resolve`
  method of `relation` and `prismaConnection`. The default will use the `findUnique` of the current
  model, with an `include` for the current relation. It is also batched together with other
  relationships to improve query efficiency.
- `totalCount`: when set to true, this will add a `totalCount` field to the connection object. see
  `relationCount` above for more details.
