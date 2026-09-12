# Prisma Plugin for Pothos

The Prisma plugin defines GraphQL types from Prisma models and builds selections for the data
requested by a GraphQL query. It supports relations, counts, type variants, and Relay nodes and
connections. GraphQL fields can have different names and shapes from the underlying models.

You can also [use Prisma with plain object refs](https://pothos-graphql.dev/docs/plugins/prisma/without-a-plugin).

## Example

This example exposes users and their posts. See [Objects](https://pothos-graphql.dev/docs/plugins/prisma/objects), [Relations](https://pothos-graphql.dev/docs/plugins/prisma/relations), and [Connections](https://pothos-graphql.dev/docs/plugins/prisma/connections).
Use the [builder setup](https://pothos-graphql.dev/docs/plugins/prisma/setup), including its `userId` context, and add the
[Relay plugin](https://pothos-graphql.dev/docs/plugins/relay) for nodes and connections. The Prisma schema has User, Post, and Profile
models with the fields and relations used below.

```typescript
// Create an object type based on a prisma model
// without providing any custom type information
builder.prismaObject('User', {
  fields: (t) => ({
    // expose fields from the database
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    bio: t.string({
      // the profile relation is nullable, so this field is too
      nullable: true,
      // automatically load the bio from the profile
      // when this field is queried
      select: {
        profile: {
          select: {
            bio: true,
          },
        },
      },
      // user will be typed correctly to include the
      // selected fields from above
      resolve: (user) => user.profile?.bio,
    }),
    // Load posts as list field.
    posts: t.relation('posts', {
      args: {
        oldestFirst: t.arg.boolean(),
      },
      // Define custom query options that are applied when
      // loading the post relation
      query: (args, context) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
    }),
    // creates relay connection that handles pagination
    // using prisma's built in cursor based pagination
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
    }),
  }),
});

// Create a relay node based a prisma model
builder.prismaNode('Post', {
  id: { field: 'id' },
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
      resolve: async (query, root, args, ctx, info) => {
        return prisma.user.findUniqueOrThrow({
          // the `query` argument will add in `include`s or `select`s to
          // resolve as much of the request in a single query as possible
          ...query,
          where: { id: ctx.userId },
        });
      },
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
so we need a separate query to handle the second `posts` relation.

## Setup

```package-install
npm install --save @pothos/plugin-prisma
```

### Setup

The Prisma plugin uses generated types to describe your models and relations. Add its generator
alongside your Prisma client generator, then pass the generated types and datamodel to the builder.

#### Add the `pothos` generator to your prisma schema

```prisma
generator pothos {
  provider = "prisma-pothos-types"
}
```

Now the types Pothos uses will be generated whenever you re-generate your prisma client. Run the
following command to re-generate the client and create the new types:

```sh
npx prisma generate
```

Generator options:

- `clientOutput`: Where the generated code will import the PrismaClient from. The default is the
  full path of wherever the client is generated. If you are checking in the generated file,
  you should specify a relative path for this import
- `output`: Where to write the generated types

Example with more options:

```prisma

generator client {
  provider      = "prisma-client"
  output        = "../lib/prisma"
}
generator pothos {
  provider = "prisma-pothos-types"
  clientOutput = "./prisma" // relative path from pothos output to prisma client
  output = "../lib/pothos-prisma-types.ts"
}
```

If model or relation completions are missing, check the client import in the generated file.

#### Set up the builder

This example uses the generated client above and a SQLite database. Install
`@prisma/adapter-better-sqlite3` for this adapter; use the adapter for your database if it differs.
`exposeDescriptions` also accepts `{ models: true, fields: true }` to configure descriptions separately.

```typescript
import SchemaBuilder from '@pothos/core';
import { PrismaClient } from '../lib/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import PrismaPlugin from '@pothos/plugin-prisma';

import type PrismaTypes from '../lib/pothos-prisma-types'; // path to generated types, specified in your prisma.schema
import { getDatamodel } from '../lib/pothos-prisma-types';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: { userId: number };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
    // This give pothos information about your tables, relations, and indexes to help it generate optimal queries at runtime.
    // This used to be attached to the prisma client, but has been removed in most runtimes/modes to reduce bundle size.
    dmmf: getDatamodel(),
    // defaults to false, uses /// comments from prisma schema as descriptions
    // for object types, relations and exposed fields.
    // descriptions can be omitted by setting description to false
    exposeDescriptions: false,
    // use where clause from prismaRelatedConnection for totalCount (defaults to true)
    filterConnectionTotalCount: true,
    // warn when not using a query parameter correctly
    onUnusedQuery: process.env.NODE_ENV === 'production' ? null : 'warn',
    // leave selections inside @defer fragments out of the planned query (defaults to true)
    skipDeferredFragments: true,
  },
});
```

The examples use an authenticated request context with `userId: number`. Supply it through your
GraphQL server; see [Context](https://pothos-graphql.dev/docs/guide/context).

Pass the Prisma client through the plugin options. Including its full type in `Context` can slow
TypeScript checking; see [this TypeScript issue](https://github.com/microsoft/TypeScript/issues/45405).

You can also load or create the prisma client dynamically for each request. This can be used to
periodically re-create clients or create read-only clients for certain types of users.

Replace the builder above with the following to select between `prisma` and a second client.
This SQLite example uses `READ_ONLY_REPLICA_URL` for a replica database maintained by your application;
the adapter does not configure replication or enforce read-only access. Configure database access
permissions separately. Both clients must use the same generated Prisma client
and schema. For another database, use its driver adapter and replica connection options.

```typescript
const replicaUrl = process.env.READ_ONLY_REPLICA_URL;
if (!replicaUrl) {
  throw new Error('READ_ONLY_REPLICA_URL is required');
}

const readOnlyPrisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: replicaUrl }),
});

const builder = new SchemaBuilder<{
  Context: { user: { isAdmin: boolean } };
  PrismaTypes: PrismaTypes;
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: (ctx) => (ctx.user.isAdmin ? prisma : readOnlyPrisma),
    dmmf: getDatamodel(),
  },
});
```

### Detecting unused query arguments

Forgetting to spread the `query` argument from `t.prismaField` or `t.prismaConnection` into your
prisma query can result in inefficient queries, or even missing data. To help catch these issues,
the plugin can warn you when you are not using the query argument correctly.

The `onUnusedQuery` option can be set to `warn` or `error` to enable this feature. When set to
`warn` it will log a warning to the console if Pothos detects that you have not properly used the
query in your resolver. Similarly if you set the option to `error` it will throw an error instead.
You can also pass a function which will receive the `info` object which can be used to log or throw
your own error.

The check tracks access to properties on the query object. If no properties are accessed on the query object before the
resolver returns, it will trigger the `onUnusedQuery` condition.

It's recommended to enable this check in development to more quickly find potential issues.

### Deferred fragments

`skipDeferredFragments` controls query planning; it does not enable incremental execution. The application
must register the defer directive and use an executor, server transport, and client that support
the same incremental delivery protocol. With GraphQL.js 17, ordinary `execute` rejects schemas
containing `@defer` or `@stream`; incremental execution uses `experimentalExecuteIncrementally`.
For a server integration, see [GraphQL Yoga's defer and stream setup](https://the-guild.dev/graphql/yoga-server/docs/features/defer-stream),
which uses `@graphql-yoga/plugin-defer-stream`. Check the integration's supported versions when
choosing an executor and client; adding directives or changing `skipDeferredFragments` alone is
not sufficient.

Selections inside a `@defer` fragment are left out of the planned query by default, so the initial
payload is not delayed by data the client has agreed to wait for. When the deferred fragment
resolves, its fields are loaded through [fallback queries](https://pothos-graphql.dev/docs/plugins/prisma/relations#fallback-queries), batched as
usual.

Set `skipDeferredFragments: false` in the plugin options to plan deferred selections with the rest
of the query. `queryFromInfo` accepts the same option per call.

## Prisma Objects

### Creating types with `builder.prismaObject`

`builder.prismaObject` takes 2 arguments:

1. `name`: The name of the prisma model this new type represents
2. `options`: options for the type being created, this is very similar to the options for any other
   object type

```typescript
builder.prismaObject('User', {
  // Optional name for the object, defaults to the name of the prisma model
  name: 'PostAuthor',
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
  }),
});
```

So far, this is just creating some simple object types. They work just like any other object type in
Pothos. The main advantage of this is that we get the type information without using object refs, or
needing imports from prisma client.

### Adding prisma fields to non-prisma objects (including Query and Mutation)

`t.prismaField` defines fields that return Prisma objects. This example uses the client and
`userId` context from [Setup](https://pothos-graphql.dev/docs/plugins/prisma/setup):

```typescript
builder.queryType({
  fields: (t) => ({
    me: t.prismaField({
      type: 'User',
      resolve: async (query, root, args, ctx, info) => {
        return prisma.user.findUniqueOrThrow({
          ...query,
          where: { id: ctx.userId },
        });
      },
    }),
  }),
});
```

This method works just like the normal `t.field` method with a couple of differences:

1. The `type` option must contain the name of the prisma model (eg. `User` or `[User]` for a list
   field).
2. The `resolve` function has a new first argument `query` which should be spread into your prisma
   query. This will be used to load data for nested relationships.

You do not need to use this method, and the `builder.prismaObject` method returns an object ref that
can be used like any other object ref (with `t.field`), but using `t.prismaField` will allow you to
take advantage of more efficient queries.

The `query` object will contain an object with `include` or `select` options to pre-load data needed
to resolve nested parts of the current query. The included/selected fields are based on which fields
are being queried, and the options provided when defining those fields and types.


#### `prismaFieldWithInput`

With the [with-input plugin](https://pothos-graphql.dev/docs/plugins/with-input),
`t.prismaFieldWithInput` combines `t.prismaField` with `t.fieldWithInput`. The `input` fields become
an input object argument, and the resolver still receives the `query` to spread as its first
argument.

```typescript
builder.mutationType({
  fields: (t) => ({
    createPost: t.prismaFieldWithInput({
      type: 'Post',
      input: {
        title: t.input.string({ required: true }),
        authorId: t.input.id({ required: true }),
      },
      resolve: (query, root, args, ctx) => {
        return prisma.post.create({
          ...query,
          data: {
            title: args.input.title,
            authorId: Number.parseInt(args.input.authorId, 10),
          },
        });
      },
    }),
  }),
});
```

### Extending prisma objects

The normal `builder.objectField(s)` methods can be used to extend prisma objects, but do not support
using selections, or exposing fields not in the default selection. To use these features, you can
use

`builder.prismaObjectField` or `builder.prismaObjectFields` instead.

### A nullable author lookup

An author page should return null when the requested author does not exist. A `t.prismaField`
passes the requested selections into `findUnique`; its GraphQL nullability matches that method's
result. This field uses the generated models and client from [Setup](https://pothos-graphql.dev/docs/plugins/prisma/setup):

```typescript
builder.queryType({
  fields: (t) => ({
    author: t.prismaField({
      type: 'User',
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) => {
        return prisma.user.findUnique({
          ...query,
          where: { id: args.id },
        });
      },
    }),
  }),
});
```

`author(id: 1) { name }` returns Maya Chen. `author(id: 999) { name }` returns null.
The type's relations can be requested through the same field without changing the resolver.

## Relations

Use `t.relation` to expose relations between models. This example uses the client and authenticated
`userId` context from [Setup](https://pothos-graphql.dev/docs/plugins/prisma/setup):

```typescript
builder.queryType({
  fields: (t) => ({
    me: t.prismaField({
      type: 'User',
      resolve: async (query, root, args, ctx, info) => {
        return prisma.user.findUniqueOrThrow({
          ...query,
          where: { id: ctx.userId },
        });
      },
    }),
  }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.relation('posts'),
  }),
});

builder.prismaObject('Post', {
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

```typescript
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

When selections cannot share a Prisma query, Pothos loads the missing data with fallback queries.

#### Fallback queries

There are some cases where data can not be pre-loaded by a prisma field. In these cases, pothos will
issue a `findUnique` query for the parent of any fields that were not pre-loaded, and select the
missing relations so those fields can be resolved with the correct data. These queries should be
very efficient, are batched by pothos to combine requirements for multiple fields into one query,
and batched by Prisma to combine multiple queries (in an n+1 situation) to a single sql query.

The following are some edge cases that could cause an additional query to be necessary:

- The parent object was not loaded through a field defined with `t.prismaField`, or `t.relation`
- The root `prismaField` did not correctly spread the `query` arguments in its prisma call.
- The query selects multiple fields that use the same relation with different filters, sorting, or
  limits
- The query contains multiple aliases for the same relation field with different arguments in a way
  that results in different query options for the relation.
- A relation field has a query that is incompatible with the default includes of the parent object

A fallback query loads the parent row again by its primary key, or by the first required unique
field or index when the model has no primary key, selecting what the missing fields need. To load
it some other way, add a `findUnique` option to the type that returns the `where` for
`prisma.<model>.findUnique`:

```typescript
builder.prismaObject('User', {
  findUnique: (user, ctx) => ({ email: user.email }),
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts'),
  }),
});
```

A type in include mode can also opt out of fallback queries with `findUnique: null`. A field that
would need one will throw `Missing findUnique for User` instead of querying.

#### Filters, Sorting, and arguments

So far we have been describing very simple queries without any arguments, filtering, or sorting. For
`t.prismaField` definitions, you can add arguments to your field like normal, and pass them into
your prisma query as needed. For `t.relation` the flow is slightly different because we are not
making a prisma query directly. We do this by adding a `query` option to our field options. Query
can either be a query object, or a method that returns a query object based on the field arguments.

```typescript
builder.prismaObject('User', {
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
`skip`, `take`, and `orderBy`. The `query` function will be passed the arguments for the field, and
the context for the current request. Because it is used for pre-loading data, and solving n+1
issues, it can not be passed the `parent` object because it may not be loaded yet.



#### Nullable relations and `onNull`

A relation that is optional in the prisma schema (`profile Profile?`) can be exposed as a nullable
field with `nullable: true`. To expose it as non-nullable, `t.relation` requires an `onNull` option
describing what should happen when the related row is missing. Setting it to `'error'` lets GraphQL
raise the non-null error for the field. A function can return a replacement value instead, or an
`Error` to raise:

```typescript
builder.prismaObject('User', {
  fields: (t) => ({
    profile: t.relation('profile', { nullable: true }),
    // An error when the user has no profile
    requiredProfile: t.relation('profile', { nullable: false, onNull: 'error' }),
    // A default when the user has no profile
    profileOrDefault: t.relation('profile', {
      nullable: false,
      onNull: (user, args, ctx, info) => ({ id: 0, userId: user.id, bio: null }),
    }),
  }),
});
```

#### relationCount

`t.relationCount` adds a field that counts related rows without loading them. Its `where` option
filters the rows included in the count:

```typescript
builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    postCount: t.relationCount('posts', {
      where: {
        published: true,
      },
    }),
  }),
});
```

### Published posts and profiles

In a publishing API, a public author page exposes published posts and an optional profile.
Drafts belong on the [private viewer](https://pothos-graphql.dev/docs/plugins/prisma/variants#the-authors-writing-desk). Filtering the list and
its count consistently prevents the count from revealing unpublished posts. Sorting by both the
timestamp and ID makes the order deterministic when two posts share a timestamp.

The following type is used by the nullable `author` lookup in [Objects](https://pothos-graphql.dev/docs/plugins/prisma/objects#a-nullable-author-lookup):

```typescript
builder.prismaNode('User', {
  id: { field: 'id' },
  select: { id: true },
  fields: (t) => ({
    name: t.exposeString('name'),
    bio: t.string({
      nullable: true,
      select: { profile: { select: { bio: true } } },
      resolve: (user) => user.profile?.bio,
    }),
    posts: t.relation('posts', {
      args: { oldestFirst: t.arg.boolean() },
      query: (args) => ({
        where: { published: true },
        orderBy: [
          { createdAt: args.oldestFirst ? 'asc' : 'desc' },
          { id: args.oldestFirst ? 'asc' : 'desc' },
        ],
      }),
    }),
    postCount: t.relationCount('posts', { where: { published: true } }),
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: { where: { published: true }, orderBy: { id: 'asc' } },
      totalCount: true,
    }),
  }),
});
```

`author(id: 1) { name bio postCount posts { title } }` returns Maya's profile and two
published posts. Nora (`id: 3`) has no profile or posts, so `bio` is null, `posts` is empty, and
`postCount` is zero. A missing relation is represented as missing data, without manufacturing a
profile record.

## Selections

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
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    bio: t.string({
      // The profile relation is nullable, so this field is too.
      nullable: true,
      // The profile relation will always be loaded, and user will now be typed to include the
      // profile field so you can return the bio from the nested profile relation.
      resolve: (user) => user.profile?.bio,
    }),
  }),
});
```

### Select mode for types

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
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
  }),
});
```

The `t.expose*` and `t.relation` methods will all automatically add selections for the exposed
fields when those fields are queried, ensuring that only the requested columns will be loaded from the
database.

In addition to the `t.expose` and `t.relation`, you can also add custom selections to other fields:

```typescript
builder.prismaObject('User', {
  select: {
    id: true,
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    bio: t.string({
      nullable: true,
      // This will select user.profile.bio when the `bio` field is queried
      select: {
        profile: {
          select: {
            bio: true,
          },
        },
      },
      resolve: (user) => user.profile?.bio,
    }),
  }),
});
```

A field-level `select` always adds to the row of the model the field is defined on, whatever type
the field returns. A `select` on a `t.prismaField` defined on `User` adds columns to the user its
resolver receives as the parent, not to the model the field returns.

### Using arguments or context in your selections

This field selects the first comment created after the supplied date, or returns null when none
exists. It assumes a registered `Date` scalar accepting JavaScript dates:

```typescript
const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    title: t.exposeString('title'),
    commentFromDate: t.string({
      nullable: true,
      args: {
        date: t.arg({ type: 'Date', required: true }),
      },
      select: (args) => ({
        comments: {
          take: 1,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          where: {
            createdAt: {
              gt: args.date,
            },
          },
        },
      }),
      resolve: (post) => post.comments[0]?.content,
    }),
  }),
});
```

### Only load a profile when requested

The [public author type](https://pothos-graphql.dev/docs/plugins/prisma/relations#published-posts-and-profiles) keeps its default selection
small. Its `bio` field declares the profile relation it needs, so a query for the author's name
alone does not load a profile. Adding `bio` adds that relation to the database query; the resolver
then reads the selected row. A nullable profile still produces a nullable biography.

This distinction matters for computed fields: a resolver accessing related data must declare that
data in its selection, even when the GraphQL field itself is just a string.

## Relay nodes

`prismaNode` adds Relay IDs and root node lookups to Prisma objects. Register the
[Relay plugin](https://pothos-graphql.dev/docs/plugins/relay); see [Connections](https://pothos-graphql.dev/docs/plugins/prisma/connections) for pagination.

> [!WARNING]
> Defining a node creates a direct lookup through `node` and `nodes`. These lookups bypass custom
> root resolvers, so permission checks or visibility filters on a list or parent field do not protect
> node refetches. An encoded global ID is an identifier, not proof of permission.
>
> Apply an access policy to node loading, the type, or its fields as appropriate. See
> [Authorizing Relay nodes](https://pothos-graphql.dev/docs/plugins/scope-auth/relay-nodes) for scope patterns and their limits.

#### `prismaNode`

The `prismaNode` method works just like the `prismaObject` method with a couple of small
differences:

- there is a new `id` option that mirrors the `id` option from `node` method of the relay plugin,
  and must contain a resolve function that returns the id from an instance of the node. Rather than
  defining a resolver for the id field, you can set the `field` option to the name of a unique
  column or index.

```typescript
builder.prismaNode('Post', {
  // This sets what database field to use for the nodes id field
  id: { field: 'id' },
  // fields work just like they do for builder.prismaObject
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});
```

If you need to customize how ids are formatted, you can add a resolver for the `id`, and provide a
`findUnique` option that can be used to load the node by its id. This is generally not necessary.

```typescript
builder.prismaNode('Post', {
  id: { resolve: (post) => String(post.id) },
  // The return value will be passed as the `where` of a `prisma.post.findUnique`
  findUnique: (id) => ({ id: Number.parseInt(id, 10) }),
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});
```

When executing the `node(id: ID!)` query with a global ID for which prisma cannot find a record in
the database, the default behavior is to throw an error. There are some scenarios where it is
preferable to return `null` instead of throwing an error. For this you can add the `nullable: true`
option:

```typescript
builder.prismaNode('Post', {
  id: { field: 'id' },
  nullable: true,
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});
```

### Refetch a public author

The publishing schema defines User as a Relay node. Its returned ID can be passed back to
`node` to fetch the author with a new selection:

```graphql
query RefetchAuthor {
  node(id: "VXNlcjox") {
    ... on User {
      name
      posts {
        title
      }
    }
  }
}
```

The ID identifies User 1. The node returns the same public fields as the author lookup, including
only published posts. A node lookup does not route through a custom root resolver, so any
access restrictions on an entity must also hold when it is loaded as a node.

Post node lookups additionally restrict rows to published posts or the requesting author's own
drafts. With `nullable: true`, a missing or inaccessible Post returns null. Merely hiding a draft
from the public connection would not prevent a client from refetching it by a known node ID.

## Connections

These examples use the [Prisma builder setup](https://pothos-graphql.dev/docs/plugins/prisma/setup) with the [Relay plugin](https://pothos-graphql.dev/docs/plugins/prisma/relay).
Register the Prisma object types used by each field. Later examples replace earlier definitions of
the same field or helper.

#### `prismaConnection`

The `prismaConnection` method on a field builder can be used to create a relay `connection` field
that also pre-loads all the data nested inside that connection.

```typescript
builder.queryType({
  fields: (t) => ({
    posts: t.prismaConnection(
      {
        type: 'Post',
        cursor: 'id',
        resolve: (query, parent, args, context, info) => {
          return prisma.post.findMany({
            ...query,
          });
        },
      },
      {}, // optional options for the Connection type
      {}, // optional options for the Edge type),
    ),
  }),
});
```

##### options

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
- `totalCount`: A function for loading the total count for the connection. This will add a
  `totalCount` field to the connection object. The `totalCount` method will receive (`connection`,
  `args`, `context`, `info`) as arguments. Note that this will not work when using a shared
  connection object (see details below)

The created connection queries currently support the following combinations of connection arguments:

- `first`, `last`, `before`, or `after` on their own
- `first` and `after`
- `last` and `before`

The following combinations are not supported:

- `before` and `after`
- `first` and `before`
- `last` and `after`

Queries for these combinations are not as useful, and generally requiring loading all records
between 2 cursors, or between a cursor and the end of the set. Generating query options for these
cases is more complex and likely very inefficient, so they will currently throw an Error indicating
the argument combinations are not supported.

The `maxSize` and `defaultSize` can also be configured globally using `maxConnectionSize` and
`defaultConnectionSize` options in the `prisma` plugin options.

#### `relatedConnection`

The `relatedConnection` method can be used to create a relay `connection` field based on a relation
of the current model.

```typescript
builder.prismaNode('User', {
  id: { field: 'id' },
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

##### options

- `cursor`: a `@unique` column of the model being connected to. This is used as the `cursor` option
  passed to prisma.
- `defaultSize`: (default: 20) The default page size to use if `first` and `last` are not provided.
- `maxSize`: (default: 100) The maximum number of nodes returned for a connection.
- `query`: A method that accepts the `args` and `context` for the connection field, and returns
  filtering and sorting logic that will be merged into the query for the relation.
- `totalCount`: when set to true, this will add a `totalCount` field to the connection object. see
  [`relationCount`](https://pothos-graphql.dev/docs/plugins/prisma/relations#relationcount) for more details. Note that this will not work when
  using a shared connection object (see details below)

#### Indirect relations as connections

`prismaConnectionHelpers` connects join rows to a different GraphQL node type. The example uses
Post.media → PostMedia.media → Media: pagination follows attachment IDs, while each node is an
image. A caption belongs to the attachment, so the same image can have different captions on two
posts. Import the helper from `@pothos/plugin-prisma` and register Post and Media first.

```typescript
const mediaConnectionHelpers = prismaConnectionHelpers(builder, 'PostMedia', {
  cursor: 'id',
  query: { orderBy: { id: 'asc' } },
  select: (nodeSelection) => ({
    caption: true,
    media: nodeSelection({ select: { id: true } }),
  }),
  resolveNode: (attachment) => attachment.media,
});
```

`select` adds the join data used by the edge and plans the Media fields requested beneath `node`.
`resolveNode` maps each attachment to its selected image. The helper also accepts `defaultSize`
and `maxSize` (defaults 20 and 100). Selecting the node ID also keeps the Prisma selection nonempty
when the operation requests only an edge caption or connection count. Other default node fields
can be added through the same `nodeSelection` argument.

Use `t.connection` to expose the result. It does not load the relation automatically: its field
selection includes `getQuery`, and its resolver passes the loaded attachments to the helper:

```typescript
builder.prismaObjectField('Post', 'mediaConnection', (t) =>
  t.connection(
    {
      type: Media,
      select: (args, ctx, nestedSelection) => ({
        _count: { select: { media: true } },
        media: mediaConnectionHelpers.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (post, args, ctx) => {
        return {
          ...mediaConnectionHelpers.resolve(post.media, args, ctx),
          totalCount: post._count.media,
        };
      },
    },
    {
      fields: (connection) => ({
        totalCount: connection.int({ resolve: (result) => result.totalCount }),
      }),
    },
    {
      fields: (edge) => ({
        caption: edge.string({ resolve: (attachment) => attachment.caption }),
      }),
    },
  ),
);
```

The parent selection counts attachments separately from the page. The second configuration
argument adds `totalCount` to the connection; the third adds fields to its edges. A page containing
one attachment can therefore report two total attachments.

```graphql
query Attachments {
  author(id: 1) {
    posts(oldestFirst: true) {
      title
      mediaConnection(first: 1) {
        totalCount
        edges {
          caption
          node {
            url
            uploadedBy {
              name
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
}
```

Both posts return the same first image, but with different captions. “Starting a seed library”
has two attachments and a next page; the cursor advances through PostMedia rows, not Media IDs.
The second page contains the seed-packets image. An attachment-free post has an empty edge list
and a zero count.

`prismaConnectionHelpers` can also be used to manually create a connection where the edge and
connections share the same model, and pagination happens directly on a relation to nodes type (even
if that relation is nested).

```ts
const commentConnectionHelpers = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
});

const SelectPost = builder.prismaObject('Post', {
  fields: (t) => ({
    title: t.exposeString('title'),
    comments: t.connection({
      type: commentConnectionHelpers.ref,
      select: (args, ctx, nestedSelection) => ({
        comments: commentConnectionHelpers.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (parent, args, ctx) => {
        return commentConnectionHelpers.resolve(parent.comments, args, ctx);
      },
    }),
  }),
});
```

To add arguments for a connection defined with a helper, it is often easiest to define the arguments
on the connection field rather than the connection helper. This allows connection helpers to be
shared between fields that may not share the same arguments:

```ts
const mediaConnectionHelpers = prismaConnectionHelpers(builder, 'PostMedia', {
  cursor: 'id',
  select: (nodeSelection) => ({
    media: nodeSelection({}),
  }),
  resolveNode: (postMedia) => postMedia.media,
});

builder.prismaObjectField('Post', 'mediaConnection', (t) =>
  t.connection({
    type: Media,
    args: {
      inverted: t.arg.boolean(),
    },
    select: (args, ctx, nestedSelection) => ({
      media: {
        ...mediaConnectionHelpers.getQuery(args, ctx, nestedSelection),
        orderBy: {
          post: {
            createdAt: args.inverted ? 'desc' : 'asc',
          },
        },
      },
    }),
    resolve: (post, args, ctx) => {
      return mediaConnectionHelpers.resolve(post.media, args, ctx);
    },
  }),
);
```

Arguments, ordering and filtering can also be defined on the helpers themselves:

```ts
const mediaConnectionHelpers = prismaConnectionHelpers(builder, 'PostMedia', {
  cursor: 'id',
  // define arguments for the connection helper, these will be available as the second argument of `select`
  args: (t) => ({
    inverted: t.arg.boolean(),
  }),
  select: (nodeSelection, args) => ({
    media: nodeSelection({}),
  }),
  query: (args) => ({
    // Custom filtering with a where clause
    where: {
      post: {
        published: true,
      },
    },
    // custom ordering including use of args
    orderBy: {
      post: {
        createdAt: args.inverted ? 'desc' : 'asc',
      },
    },
  }),
  resolveNode: (postMedia) => postMedia.media,
});

builder.prismaObjectField('Post', 'mediaConnection', (t) =>
  t.connection({
    type: Media,
    // add the args from the connection helper to the field
    args: mediaConnectionHelpers.getArgs(),
    select: (args, ctx, nestedSelection) => ({
      media: mediaConnectionHelpers.getQuery(args, ctx, nestedSelection),
    }),
    resolve: (post, args, ctx) => {
      return mediaConnectionHelpers.resolve(post.media, args, ctx);
    },
  }),
);
```

#### Sharing Connections objects

You can create reusable connection objects by using `builder.connectionObject`.

These connection objects can be used with `t.prismaConnection`, `t.relatedConnection`, or
`t.connection`

Shared edges can also be created using `builder.edgeObject`

```typescript
const CommentConnection = builder.connectionObject({
  type: commentConnectionHelpers.ref,
  name: 'CommentConnection',
});

builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    commentsConnection: t.relatedConnection(
      'comments',
      { cursor: 'id' },
      // The connection object ref can be passed in place of the connection object options
      CommentConnection
    ),
  }),
});
```

#### Extending connection edges

Edge fields can read data from the row paginated by the helper. In the attachment connection,
`select` loads `caption` from PostMedia and the third `t.connection` argument exposes it:

```typescript
fields: (edge) => ({
  caption: edge.string({ resolve: (attachment) => attachment.caption }),
}),
```

The edge parent is inferred from the helper's resolved rows. Its caption describes the attachment;
`node.url` describes the shared Media record.

For a timestamp on the join model instead, select `createdAt: true` in the helper and add this
edge field. This alternative requires a `PostMedia.createdAt` column and a registered `DateTime`
scalar whose output is `Date`:

```ts
createdAt: edge.field({
  type: 'DateTime',
  resolve: (attachment) => attachment.createdAt,
}),
```

#### Total count on shared connection objects

If you set the `totalCount: true` on a `prismaConnection` or `relatedConnection` field, and are
using a custom connection object, you will need to add the `totalCount` field to the
connection object manually. The parent object on the connection will have a `totalCount` property
that is either the totalCount, or a function that will return the totalCount.

```typescript
const CommentConnection = builder.connectionObject({
  type: commentConnectionHelpers.ref,
  name: 'CommentConnection',
  fields: (t) => ({
    totalCount: t.int({
      resolve: (connection) => {
        const { totalCount } = connection as {
          totalCount?: number | (() => number | Promise<number>);
        };

        return typeof totalCount === 'function' ? totalCount() : totalCount;
      },
    }),
  }),
});
```

If you want to add a global `totalCount` field, you can do something similar using
`builder.globalConnectionField`:

```typescript
export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Connection: {
    totalCount: number | (() => number | Promise<number>);
  };
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
  },
});

builder.globalConnectionField('totalCount', (t) =>
  t.int({
    nullable: false,
    resolve: (parent) => {
      return typeof parent.totalCount === 'function' ? parent.totalCount() : parent.totalCount;
    },
  }),
);
```

#### `parsePrismaCursor` and `formatPrismaCursor`

These functions can be used to manually parse and format cursors that are compatible with prisma
connections.

Parsing a cursor will return the value from the column used for the cursor (often the `id`), this
value may be an array or object when a compound index is used as the cursor. Similarly, to format a
cursor, you must provide the column(s) that make up the cursor.

### Page through published posts

These queries use `nodes` on connections. Enable `relay: { nodesOnConnection: true }` in the
builder options, or select `edges { node { title } }` with the default Relay configuration.

A public post connection applies the same `published` filter as author pages. The publishing
schema uses this root connection alongside its private viewer:

```typescript
builder.queryFields((t) => ({
  me: t.prismaField({
    type: Viewer,
    resolve: (query, _root, _args, ctx) => {
      return prisma.user.findUniqueOrThrow({
        ...query,
        where: { id: ctx.userId },
      });
    },
  }),
  posts: t.prismaConnection({
    type: 'Post',
    cursor: 'id',
    resolve: (query) => {
      return prisma.post.findMany({
        ...query,
        where: { published: true },
        orderBy: { id: 'asc' },
      });
    },
    totalCount: () => {
      return prisma.post.count({
        where: { published: true },
      });
    },
  }),
  searchPosts: t.prismaField({
    type: ['Post'],
    args: { where: t.arg({ type: PostWhere }), orderBy: t.arg({ type: PostOrderBy }) },
    resolve: (query, _root, args) => {
      return prisma.post.findMany({
        ...query,
        // Caller filters can narrow this scope, but cannot expose drafts.
        where: { AND: [{ published: true }, args.where ?? {}] },
        orderBy: args.orderBy ? [args.orderBy, { id: 'asc' }] : { id: 'asc' },
      });
    },
  }),
}));
```

```graphql
query PublishedPosts {
  posts(first: 2) {
    nodes {
      title
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
```

There are three published posts and two drafts in the seed data. The first page contains two
published posts and has a next page. Passing its `endCursor` as `after` returns the remaining
published post. The related author connection uses the same filter for its nodes and `totalCount`,
so Maya's count is two, including when the client requests only the count.

## Type variants

The prisma plugin supports defining multiple GraphQL types based on the same prisma model.
Additional types are called `variants`. Define a primary type as shown in [Objects](https://pothos-graphql.dev/docs/plugins/prisma/objects).
The examples below are alternatives using the User and Post models, with an integer User id,
a User.posts relation, and a Boolean Post.published column. Node examples require the
[Relay plugin](https://pothos-graphql.dev/docs/plugins/prisma/relay). Use the authenticated `userId` context from [Setup](https://pothos-graphql.dev/docs/plugins/prisma/setup).

Define an additional variant by providing `variant` instead of `name`:

```typescript
const Viewer = builder.prismaObject('User', {
  variant: 'Viewer',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});
```

You can define variant fields that reference one variant from another:

```typescript
const Viewer = builder.prismaObject('User', {
  variant: 'Viewer',
  fields: (t) => ({
    id: t.exposeID('id'),
    // Using the model name ('User') will reference the primary variant
    user: t.variant('User'),
  }),
});

const User = builder.prismaNode('User', {
  id: { field: 'id' },
  fields: (t) => ({
    // To reference another variant, use the returned object Ref instead of the model name:
    viewer: t.variant(Viewer, {
      // return null for viewer if the parent User is not the current user
      isNull: (user, args, ctx) => user.id !== ctx.userId,
    }),
    email: t.exposeString('email'),
  }),
});
```

You can also use variants when defining relations by providing a `type` option:

```typescript
const PostDraft = builder.prismaNode('Post', {
  variant: 'PostDraft',
  // This sets what database field to use for the nodes id field
  id: { field: 'id' },
  // fields work just like they do for builder.prismaObject
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});

const Viewer = builder.prismaObject('User', {
  variant: 'Viewer',
  fields: (t) => ({
    id: t.exposeID('id'),
    drafts: t.relation('posts', {
      // This will cause this relation to use the PostDraft variant rather than the default Post variant
      type: PostDraft,
      query: { where: { published: false } },
    }),
  }),
});
```

You may run into circular reference issues if you use 2 prisma object refs to reference each other.
To avoid this, you can split out the field definition for one of the relationships using
`builder.prismaObjectField`

```typescript
const Viewer = builder.prismaObject('User', {
  variant: 'Viewer',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const User = builder.prismaNode('User', {
  id: { field: 'id' },
  fields: (t) => ({
    email: t.exposeString('email'),
  }),
});

// Add the reference after both types have been defined.
builder.prismaObjectField(Viewer, 'user', (t) => t.variant(User));
```

This same workaround applies when defining relations using variants.

Two variants of one model selected for the same row have their type-level selections merged into a
single query, which can fail if they disagree. See
[Conflicting selections between variants](https://pothos-graphql.dev/docs/plugins/prisma/query-planning#conflicting-selections-between-variants).

### The author’s writing desk

A public User and a private Viewer can represent the same row. The Viewer exposes the current
author's email and drafts, and its `user` field returns the public representation. The root `me`
resolver uses the authenticated context ID; it does not accept an arbitrary author's ID.

This version makes Viewer an interface so editor and author accounts can expose different fields:

```typescript
const Viewer = builder.prismaInterface('User', {
  variant: 'Viewer',
  select: { id: true, isAdmin: true },
  resolveType: (user) => (user.isAdmin ? 'EditorViewer' : 'AuthorViewer'),
  fields: (t) => ({
    user: t.variant('User'),
    email: t.exposeString('email'),
    drafts: t.relation('posts', {
      query: { where: { published: false }, orderBy: { id: 'asc' } },
    }),
  }),
});
builder.prismaObject('User', {
  variant: 'EditorViewer',
  interfaces: [Viewer],
  select: { id: true, isAdmin: true },
  fields: (t) => ({ canReviewSubmissions: t.boolean({ resolve: () => true }) }),
});
builder.prismaObject('User', {
  variant: 'AuthorViewer',
  interfaces: [Viewer],
  select: { id: true, isAdmin: true },
});
```

With Maya's context (`userId: 1`), `me` is an EditorViewer with the draft “Planning the spring
exchange.” With Leo's context (`userId: 2`), it is an AuthorViewer with “Saving rainwater.”
The interface describes the result shape; the root lookup supplies the ownership restriction.
Neither public author fields nor public post connections return those drafts.

## Indirect relations

### Selecting fields from a nested GraphQL field

By default, the `nestedSelection` function will return selections based on the type of the current
field. `nestedSelection` can also be used to get a selection from a field nested deeper inside other
fields. This is useful if the field returns a type that is not a `prismaObject`, but a field nested
inside the returned type is.

```typescript
import type { Post } from '../lib/prisma/client';

const PostRef = builder.prismaObject('Post', {
  fields: (t) => ({
    title: t.exposeString('title'),
    content: t.exposeString('content', { nullable: true }),
    author: t.relation('author'),
  }),
});

const PostPreview = builder.objectRef<Post>('PostPreview').implement({
  fields: (t) => ({
    post: t.field({
      type: PostRef,
      resolve: (post) => post,
    }),
    preview: t.string({
      nullable: true,
      resolve: (post) => post.content?.slice(0, 10),
    }),
  }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    postPreviews: t.field({
      select: (args, ctx, nestedSelection) => ({
        posts: nestedSelection(
          {
            // limit the number of postPreviews to load
            take: 2,
          },
          // Look at the selections in postPreviews.post to determine what relations/fields to select
          ['post'],
          // (optional) If the field returns a union or interface, you can pass a typeName to get selections for a specific object type
          'Post',
        ),
      }),
      type: [PostPreview],
      resolve: (user) => user.posts,
    }),
  }),
});
```

`nestedSelection` returns the relation query for the type it selected, which for a `Post` is
`{ select?, include?, where?, orderBy?, take?, skip?, cursor? }`. Any keys you pass in are kept as
they were given, so a `select` passed to `nestedSelection` will still narrow the parent's shape.
With no argument, or with `true`, it returns the planned selection on its own.

#### Pinning a type in the path

The `path` is followed through fragments, so a segment is found whether the field is selected
directly, or under a fragment on an implementation of the field's type. When several
implementations share the same field name, a segment can be written as `{ name, type }` to name the
implementation the field must be found under. Only selections of that field under a fragment on
that type, or one of its subtypes, will be planned:

```typescript
builder.prismaObject('User', {
  fields: (t) => ({
    entries: t.field({
      type: [Entry],
      select: (args, ctx, nestedSelection) => ({
        // Plan what `post` selects under `... on PostEntry`, not under other implementations
        posts: nestedSelection({ take: 2 }, [{ name: 'post', type: 'PostEntry' }]),
      }),
      resolve: (user) => {
        return user.posts.map((post) => ({ kind: 'post', post }));
      },
    }),
  }),
});
```

The same segments can be used in `queryFromInfo`'s `path` and `paths` options. The type is exported
as `PathSegment`.

#### Selecting as a specific type

When the field returns an interface or union, the third argument names the object type the
selection should be read as. Its type-level selection and the fields selected under a fragment on
it are planned, and fragments on other types are left out. With an empty path, this applies to the
field's own return type:

```typescript
// Activity is a union of Post and Comment
builder.prismaObject('User', {
  fields: (t) => ({
    recentActivity: t.field({
      type: [Activity],
      select: (args, ctx, nestedSelection) => ({
        // What the query selects under `... on Post`, as a query for the posts relation
        posts: nestedSelection({ take: 5 }, [], 'Post'),
        // and under `... on Comment`, for the comments relation
        comments: nestedSelection({ take: 5 }, [], 'Comment'),
      }),
      resolve: (user) => [...user.posts, ...user.comments],
    }),
  }),
});
```

### Indirect relations (eg. Join tables)

If you want to define a GraphQL field that directly exposes data from a nested relationship (many to
many relations using a custom join table is a common example of this) you can use the
`nestedSelection` function passed to `select`.

Given a prisma schema like the following:

```
model Post {
  id        Int         @id @default(autoincrement())
  title     String
  content   String
  media     PostMedia[]
}

model Media {
  id           Int         @id @default(autoincrement())
  url          String
  posts        PostMedia[]
  uploadedBy   User        @relation(fields: [uploadedById], references: [id])
  uploadedById Int
}

model PostMedia {
  id      Int   @id @default(autoincrement())
  post    Post  @relation(fields: [postId], references: [id])
  media   Media @relation(fields: [mediaId], references: [id])
  postId  Int
  mediaId Int
}
```

You can define a media field that can pre-load the correct relations based on the graphql query:

```typescript
const PostWithMedia = builder.prismaObject('Post', {
  fields: (t) => ({
    title: t.exposeString('title'),
    media: t.field({
      select: (args, ctx, nestedSelection) => ({
        media: {
          select: {
            // This will look at what fields are queried on Media
            // and automatically select uploadedBy if that relation is requested
            media: nestedSelection(
              // This argument is the default query for the media relation
              // It could be something like: `{ select: { id: true } }` instead
              true,
            ),
          },
        },
      }),
      type: [Media],
      resolve: (post) => {
        return post.media.map(({ media }) => media);
      },
    }),
  }),
});

const Media = builder.prismaObject('Media', {
  select: {
    id: true,
  },
  fields: (t) => ({
    url: t.exposeString('url'),
    uploadedBy: t.relation('uploadedBy'),
  }),
});
```

### Shared media on published posts

The schema stores attachment rows in PostMedia, but clients request Media objects.
`nestedSelection` follows the media field's selection through that join, including the uploader
when requested:

```typescript
const Post = builder.prismaNode('Post', {
  nullable: true,
  id: { field: 'id' },
  select: { id: true },
  // Node refetches must apply the same visibility rule as root fields.
  findUnique: (id, context) => ({
    id: Number(id),
    OR: [{ published: true }, { authorId: context.userId }],
  }),
  fields: (t) => ({
    title: t.exposeString('title'),
    published: t.exposeBoolean('published'),
    author: t.relation('author'),
    comments: t.relation('comments', { query: { orderBy: { id: 'asc' } } }),
    media: t.field({
      type: [Media],
      select: (_args, _ctx, nestedSelection) => ({
        media: { orderBy: { id: 'asc' }, select: { media: nestedSelection(true) } },
      }),
      resolve: (post) => {
        return post.media.map(({ media }) => media);
      },
    }),
  }),
});
```

Both “Starting a seed library” and “A guide to composting” attach the same image, uploaded by Leo.
Querying `posts { title media { url uploadedBy { name } } }` through Maya's author page returns
that uploader for both posts. The GraphQL shape need not expose the join table just because the
database uses one.

## Interfaces

`builder.prismaInterface` works just like builder.prismaObject and can be used to define either the
primary type or a variant for a model.

The following example creates a `User` interface, and 2 variants Admin and Member. The `resolveType`
method returns the typenames as strings to avoid issues with circular references.

```typescript
const User = builder.prismaInterface('User', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
  }),
  resolveType: (user) => {
    return user.isAdmin ? 'Admin' : 'Member';
  },
});

builder.prismaObject('User', {
  variant: 'Admin',
  interfaces: [User],
  fields: (t) => ({
    isAdmin: t.exposeBoolean('isAdmin'),
  }),
});

builder.prismaObject('User', {
  variant: 'Member',
  interfaces: [User],
  fields: (t) => ({
    bio: t.exposeString('bio'),
  }),
});
```

When using select mode, it's recommended to add selections to both the interface and the object
types that implement them. Selections are not inherited and will fallback to the default selection
which includes all scalar columns.

You will not be able to extend an interface for a different prisma model, doing so will result in an
error at build time.

### Selecting a viewer implementation

The [writing desk](https://pothos-graphql.dev/docs/plugins/prisma/variants#the-authors-writing-desk) uses a Viewer interface for the signed-in
author and two object variants for account capabilities. Its type-level selection includes the
discriminator (`isAdmin`) used by `resolveType`. Each implementation also selects the fields
required by that interface; configuring a selection on the interface does not replace the
implementation's selection.

```graphql
query WritingDesk {
  me {
    __typename
    drafts {
      title
    }
    ... on EditorViewer {
      canReviewSubmissions
    }
  }
}
```

The editor result includes `canReviewSubmissions: true`. An author result has no field from that
fragment, while retaining the interface's `drafts` field. This keeps the public User type separate
from account-specific capabilities.

## Prisma Utils

> **Note:**
  This package is highly experimental and not recommended for production use


The plugin adds new helpers for creating prisma compatible input types. Use it alongside the Prisma plugin when you want these input helpers.

### Setup

To use this plugin, you will need to enable prismaUtils option in the generator in your
schema.prisma:

```prisma

generator client {
  provider      = "prisma-client"
  output        = "../lib/prisma"
}
generator pothos {
  provider = "prisma-pothos-types"
  clientOutput = "./prisma" // relative path from pothos output to prisma client
  output = "../lib/pothos-prisma-types.ts"
  // Enable prismaUtils feature
  prismaUtils  = true
}
```

Once this is enabled, add the plugin alongside the Prisma plugin. This example also uses
`graphql-scalars` to register the `DateTime` scalar used by the input helpers:

```package-install
npm install @pothos/plugin-prisma-utils graphql-scalars @prisma/adapter-better-sqlite3
```

```ts
import SchemaBuilder from '@pothos/core';
import { DateTimeResolver } from 'graphql-scalars';
import { PrismaClient } from '../lib/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import type PrismaTypes from '../lib/pothos-prisma-types';
import { getDatamodel } from '../lib/pothos-prisma-types';
import PrismaPlugin from '@pothos/plugin-prisma';
import PrismaUtils from '@pothos/plugin-prisma-utils';

export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});

const builder = new SchemaBuilder<{
  Scalars: {
    DateTime: {
      Input: Date;
      Output: Date;
    };
  };
  PrismaTypes: PrismaTypes;
}>({
  plugins: [PrismaPlugin, PrismaUtils],
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
  },
});

builder.addScalarType('DateTime', DateTimeResolver, {});
```

### What can you do with this plugin

The helpers build filters, ordering, create inputs, and update inputs using the generated Prisma
types. You choose which fields and operations your API exposes.

### What is supported so far

#### Creating filter types for scalars and enums

```typescript
const StringFilter = builder.prismaFilter('String', {
  ops: ['contains', 'equals', 'startsWith', 'not'],
});

export const IDFilter = builder.prismaFilter('Int', {
  ops: ['equals', 'not'],
});

builder.enumType(MyEnum, { name: 'MyEnum' });
const MyEnumFilter = builder.prismaFilter(MyEnum, {
  ops: ['not', 'equals'],
});
```

#### Creating filters for Prisma objects (compatible with a "where" clause)

```typescript
const UserWhere = builder.prismaWhere('User', {
  fields: {
    id: IDFilter,
  },
});

const PostFilter = builder.prismaWhere('Post', {
  fields: (t) => ({
    // You can use either filters
    id: IDFilter,
    // or scalar types to only support equality
    title: 'String',
    createdAt: 'DateTime',
    // Relations are supported by referencing other scalars
    author: UserWhere,
    // use t.field to provide other field options
    authorId: t.field({ type: IDFilter, description: 'filter by author id' }),
  }),
});
```

#### Creating list filters for scalars

```typescript
export const StringListFilter = builder.prismaScalarListFilter('String', {
  name: 'StringListFilter',
  ops: ['has', 'hasSome', 'hasEvery', 'isEmpty', 'equals'],
});
```

#### Creating list filters for Prisma objects

```typescript
const UserListFilter = builder.prismaListFilter(UserWhere, {
  ops: ['every', 'some', 'none'],
});
```

#### Creating OrderBy input types

```typescript
const UserOrderBy = builder.prismaOrderBy('User', {
  fields: {
    name: true,
  },
});

export const PostOrderBy = builder.prismaOrderBy('Post', {
  fields: () => ({
    id: true,
    title: true,
    createdAt: true,
    author: UserOrderBy,
  }),
});
```

#### Inputs for create mutations

You can use `builder.prismaCreate` to create input types for create mutations.

To get these types to work correctly for circular references, it is recommended to add explicit type
annotations, but for simple types that do not have circular references the explicit types can be
omitted.

```ts
import { InputObjectRef } from '@pothos/core';
import type { Prisma } from '../lib/prisma/client';

export const UserCreate: InputObjectRef<Prisma.UserCreateInput> = builder.prismaCreate('User', {
  name: 'UserCreate',
  fields: () => ({
    // scalars
    id: 'Int',
    email: 'String',
    name: 'String',
    // inputs for relations need to be defined separately as shown below
    profile: UserCreateProfile,
    // create fields for list relations are defined just like normal relations.
    // Pothos will automatically handle making the inputs lists
    posts: UserCreatePosts,
  }),
});

export const UserCreateProfile = builder.prismaCreateRelation('User', 'profile', {
  fields: () => ({
    // created with builder.prismaCreate as shown above for User
    create: ProfileCreateWithoutUser,
    // created with builder.prismaWhere
    connect: ProfileUniqueFilter,
  }),
});

export const UserCreatePosts = builder.prismaCreateRelation('User', 'posts', {
  fields: () => ({
    // created with builder.prismaCreate as shown above for User
    create: PostCreateWithoutAuthor,
    // created with builder.prismaWhere
    connect: PostUniqueFilter,
  }),
});
```

#### Inputs for update mutations

You can use `builder.prismaUpdate` to create input types for update mutations.

To get these types to work correctly for circular references, it is recommended to add explicit type
annotations, but for simple types that do not have circular references the explicit types can be
omitted.

```ts
export const UserUpdate: InputObjectRef<Prisma.UserUpdateInput> = builder.prismaUpdate(
  'User',
  {
    name: 'UserUpdate',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      // inputs for relations need to be defined separately as shown below
      profile: UserUpdateProfile,
      posts: UserUpdatePosts,
    }),
  },
);

export const UserUpdateProfile = builder.prismaUpdateRelation('User', 'profile', {
  fields: () => ({
    // created with builder.prismaCreate
    create: ProfileCreateWithoutUser,
    // created with builder.prismaUpdate
    update: ProfileUpdateWithoutUser,
    // created with builder.prismaWhereUnique
    connect: ProfileUniqueFilter,
  }),
});

export const UserUpdatePosts = builder.prismaUpdateRelation('User', 'posts', {
  fields: () => ({
    // Not all update methods need to be defined
    // created with builder.prismaCreate
    create: PostCreateWithoutAuthor,
    // created with builder.prismaCreateMany
    createMany: {
      skipDuplicates: 'Boolean',
      data: PostCreateManyWithoutAuthor,
    },
    // created with builder.prismaWhereUnique
    set: PostUniqueFilter,
    // created with builder.prismaWhereUnique
    disconnect: PostUniqueFilter,
    delete: PostUniqueFilter,
    connect: PostUniqueFilter,

    update: {
      // created with builder.prismaWhereUnique
      where: PostUniqueFilter,
      // created with builder.prismaUpdate
      data: PostUpdateWithoutAuthor,
    },
    updateMany: {
      // created with builder.prismaWhere
      where: PostWithoutAuthorFilter,
      // created with builder.prismaUpdate
      data: PostUpdateWithoutAuthor,
    },
    // created with builder.prismaWhere
    deleteMany: PostWithoutAuthorFilter,
  }),
});
```

##### Atomic Int Update operations

```ts
const IntUpdate = builder.prismaIntAtomicUpdate();
// or with options
const IntUpdate = builder.prismaIntAtomicUpdate({
  name: 'IntUpdate',
  ops: ['increment', 'decrement'],
});

export const PostUpdate = builder.prismaUpdate('Post', {
  name: 'PostUpdate',
  fields: () => ({
    title: 'String',
    views: IntUpdate,
  }),
});
```

### Generators

Manually defining all the different input types shown above for a large number of tables can become
very repetitive. These utilities are designed to be building blocks for generators or utility
functions, so that you don't need to hand write these types yourself.

Pothos does not currently ship an official generator for prisma types, but there are a couple of
example generators that can be copied and modified to suit your needs. These are intentionally
somewhat limited in functionality and not written to be easily exported because they will be updated
with breaking changes as these utilities are developed further. They are only intended as building
blocks for you to build your own generators.

There are 2 main approaches:

1. Static Generation: Types are generated and written as a typescript file which can be imported
   from as part of your schema
2. Dynamic Generation: Types are generated dynamically at runtime through helpers imported from your
   App

#### Static generator

You can find an
[example static generator here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/codegen/generator.ts)

This generator will generate a file with input types for every table in your schema as shown
[here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/codegen/schema/prisma-inputs.ts)

These generated types can be used in your schema as shown
[here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/codegen/schema/index.ts)

#### Dynamic generator

You can find an example
[dynamic generator here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/crud/generator.ts)

This generator exports a class that can be used to dynamically create input types for your builder
as shown
[here](https://github.com/hayes/pothos/blob/main/packages/plugin-prisma-utils/tests/examples/crud/schema/index.ts#L9-L20)

### Filters and draft inputs in one API

The schema uses these helpers to expose a small, intentional input surface. A title
filter and ordering input support public post search:

```typescript
const TitleFilter = builder.prismaFilter('String', { ops: ['contains', 'equals'] });
const PostWhere = builder.prismaWhere('Post', {
  fields: { title: TitleFilter },
});
const PostOrderBy = builder.prismaOrderBy('Post', { fields: { title: true, id: true } });
```

The `searchPosts` resolver combines the caller's filter with `published: true` using `AND`.
A caller can narrow the public result set, but cannot expand it to drafts. The selected ordering
also gets an ID tie breaker for deterministic results.

Draft creation and editing expose only title and content. The resolver supplies ownership from
the authenticated context and keeps publication state outside the input:

```typescript
const DraftInput = builder.prismaCreate('Post', {
  name: 'DraftInput',
  fields: { title: 'String', content: 'String' },
});
const DraftUpdate = builder.prismaUpdate('Post', {
  name: 'DraftUpdate',
  fields: { title: 'String', content: 'String' },
});
const CreateDraftResult = builder.objectRef<{ post: PostRow }>('CreateDraftResult').implement({
  fields: (t) => ({ post: t.field({ type: Post, resolve: (result) => result.post }) }),
});
builder.mutationType({
  fields: (t) => ({
    createDraft: t.prismaField({
      type: 'Post',
      args: { input: t.arg({ type: DraftInput, required: true }) },
      resolve: (query, _root, args, ctx) => {
        return prisma.post.create({
          ...query,
          data: { ...args.input, author: { connect: { id: ctx.userId } } },
        });
      },
    }),
    updateDraft: t.prismaField({
      type: 'Post',
      args: {
        id: t.arg.int({ required: true }),
        input: t.arg({ type: DraftUpdate, required: true }),
      },
      resolve: (query, _root, args, ctx) => {
        return prisma.post.update({
          ...query,
          where: { id: args.id, authorId: ctx.userId, published: false },
          data: args.input,
        });
      },
    }),
    createDraftWithPayload: t.field({
      type: CreateDraftResult,
      args: {
        title: t.arg.string({ required: true }),
        content: t.arg.string({ required: true }),
      },
      resolve: async (_root, args, context, info) => {
        return {
          post: await prisma.post.create({
            ...queryFromInfo({ context, info, path: ['post'] }),
            data: { ...args, authorId: context.userId },
          }),
        };
      },
    }),
  }),
});
```

Creating “Mulching paths” returns an unpublished post owned by the current author, including its
requested author relation. Updating another author's draft fails and leaves its title unchanged.
`createDraftWithPayload` returns a post inside a result object, so `queryFromInfo` uses `path:
['post']` to plan the nested selection. These are application decisions; input generation does not
provide authorization by itself.

Scalar-list filters require a database that supports Prisma scalar lists.

## Prisma without a plugin

Use `builder.objectRef` with the generated Prisma model types and write resolvers that query your client.

This example uses a generated Prisma client with User and Post models, backed by SQLite.
Use the driver adapter for your database, and adjust the client import to your generated output.
Create a builder with an authenticated `userId` context:

```typescript
import SchemaBuilder from '@pothos/core';
import { PrismaClient, type Post, type User } from '../lib/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const builder = new SchemaBuilder<{ Context: { userId: number } }>({});

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' }),
});
const UserObject = builder.objectRef<User>('User');
const PostObject = builder.objectRef<Post>('Post');

UserObject.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.field({
      type: [PostObject],
      resolve: (user) => {
        return db.post.findMany({
          where: { authorId: user.id },
        });
      },
    }),
  }),
});

PostObject.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.field({
      type: UserObject,
      resolve: (post) => {
        return db.user.findUniqueOrThrow({
          where: { id: post.authorId },
        });
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.field({
      type: UserObject,
      resolve: (root, args, ctx) => {
        return db.user.findUniqueOrThrow({
          where: { id: ctx.userId },
        });
      },
    }),
  }),
});
```

This sets up User, and Post objects with a few fields, and a `me` query that returns the current
user. There are a few things to note in this setup:

1. We split up the `builder.objectRef` and the `implement` calls, rather than calling
   `builder.objectRef(...).implement(...)`. This prevents typescript from getting tripped up by the
   circular references between posts and users.
2. We use `findUniqueOrThrow` because those fields are not nullable. Using `findUnique`, prisma will
   return a null if the object is not found. An alternative is to mark these fields as nullable.
3. The refs to our object types are called `UserObject` and `PostObject`, this is because `User` and
   `Post` are the names of the types imported from prisma. We could instead alias the types when we
   import them so we can name the refs to our GraphQL types after the models.

This setup is fairly simple, but it is easy to see the n+1 issues we might run into. Prisma helps
with this by batching queries together, but there are also things we can do in our implementation to
improve things.

One thing we could do if we know we will usually be loading the author any time we load a post is to
include the author in the backing type for a post. Replace the refs and implementations above with:

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
      resolve: (user) => {
        return db.post.findMany({
          // We now need to include the author when we query for posts
          include: {
            author: true,
          },
          where: { authorId: user.id },
        });
      },
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
back to a query if the parent resolver did not include it. Replace `PostObject` and its implementation with:

```typescript
const PostObject = builder.objectRef<Post & { author?: User }>('Post');

PostObject.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.field({
      type: UserObject,
      resolve: (post) =>
        post.author ?? db.user.findUniqueOrThrow({ where: { id: post.authorId } }),
    }),
  }),
});
```

With this setup, a parent resolver has the option to include the author, but we have a fallback
in case it does not.

The [Dataloader plugin](https://pothos-graphql.dev/docs/plugins/dataloader) provides another way to batch loads across resolvers.

### Compare the same author page

A publishing API can also define the author lookup with ordinary object refs, using the same
Prisma models and database. The refs describe the backing rows; each relation resolver
queries Prisma explicitly:

```typescript
const builder = new SchemaBuilder({});
const Author = builder.objectRef<User>('Author');
const Article = builder.objectRef<Post>('Article');
Author.implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    posts: t.field({
      type: [Article],
      resolve: (author) => {
        return prisma.post.findMany({
          where: { authorId: author.id, published: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
      },
    }),
  }),
});
Article.implement({
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.field({
      type: Author,
      resolve: (post) => {
        return prisma.user.findUniqueOrThrow({
          where: { id: post.authorId },
        });
      },
    }),
  }),
});
builder.queryType({
  fields: (t) => ({
    author: t.field({
      type: Author,
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (_root, args) => {
        return prisma.user.findUnique({
          where: { id: args.id },
        });
      },
    }),
  }),
});
```

`author(id: 1) { name posts { title author { name } } }` returns the same published posts as the
plugin-backed lookup. The plugin version plans relation selections into the root query; this
version makes those calls in its field resolvers. The selection, eager-loading, and fallback
alternatives above remain useful when choosing how to manage those calls yourself.

## Query planning

This page describes how the plugin turns a GraphQL query into prisma queries, which is worth
knowing when a schema issues more queries than you expect.

### How fields get their data

A field either reads its data from a row that has already been loaded, or runs a query of its own.

A field's `select` is planned into the query of the nearest ancestor that runs one: a
`t.prismaField`, a `t.relation`, a connection, or a
[fallback query](https://pothos-graphql.dev/docs/plugins/prisma/relations#fallback-queries). The field then reads what it needs off the loaded
row, without a query of its own. A field runs its own query when its `resolve` queries prisma
directly, and when the plugin issues a fallback query for a `t.relation` that is missing from the
row.

A field can do both. A `t.prismaField`, or any other field with a `select`, nested under one of
those ancestors has its `select` planned into the parent's row, and still runs its own query when
it resolves.

A field-level `select` is merged into the same query as its siblings and the type-level selection,
rather than getting a copy of the row for that field alone. Two selections of the same relation
share a place in that query only when their arguments (`where`, `orderBy`, `take`, ...) match. When
they differ, the first one planned wins, and the other is loaded with a query of its own. A
type-level `select` or `include` is planned before any field's selection, no matter where they
appear in the document, and fields are planned in the order they are selected.

### Async selections

Selections are synchronous unless the schema opts in with `AsyncSelections: true`. This example
uses request context methods that asynchronously return a user ID and a preview limit:

```typescript
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  AsyncSelections: true;
  Context: {
    currentUserId: () => Promise<number>;
    previewSize: () => Promise<number>;
  };
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
  },
});
```

With the opt-in, `select` functions, relation `query` callbacks, `relationCount` `where` callbacks,
and the `select` and `query` callbacks of `prismaConnectionHelpers` may be async. Without it they
are typed as synchronous, and an async callback is a type error.

The plugin still builds a single query. It waits for the callbacks, and merges what they return
after every synchronous selection, in document order. `t.relation`, `t.relationCount`,
`t.prismaField`, `t.prismaConnection` and `t.relatedConnection` settle their plan before the
resolver runs, and need no changes. The following example uses a registered `Comment` Prisma
object ref and its Post.comments relation:

```typescript
builder.prismaObject('Post', {
  fields: (t) => ({
    comments: t.relation('comments', {
      query: async (args, ctx) => ({ where: { authorId: await ctx.currentUserId() } }),
    }),
    previewComments: t.field({
      type: [Comment],
      select: async (args, ctx, nestedSelection) => ({
        comments: await nestedSelection({ take: await ctx.previewSize() }),
      }),
      resolve: (post) => post.comments,
    }),
  }),
});
```

`await` what `nestedSelection` returns before putting it in the selection. A selection that
contains the promise itself will throw, and so will a `select` that returns while a nested
selection it started is still pending. Calling `nestedSelection` and discarding a synchronous
result is not detected, and the nested selection will not be loaded with the parent, so the field
falls back to its own query.

Pass `awaitSelections: true` to `queryFromInfo` and `prismaConnectionHelpers(...).getQuery`, and
`await` the query they return. Without it, an async selection beneath the field throws, and
whether there is one depends on the incoming document rather than on the callback you wrote. A
connection helper also throws when its own `select` or `query` is async, whatever the document
asked for:

```typescript
const post = await prisma.post.findUniqueOrThrow({
  where: { id: args.id },
  ...(await queryFromInfo({ context, info, awaitSelections: true })),
});
```

`awaitSelections` is a per-call option, and is available whether or not the schema sets
`AsyncSelections`.

### Optimized queries without `t.prismaField`

In some cases, it may be useful to get an optimized query for fields where you can't use
`t.prismaField`.

This may be required for combining with other plugins, or because your query does not directly
return a `PrismaObject`. In these cases, you can use the `queryFromInfo` helper. An example of this
might be a mutation that wraps the prisma object in a result type.

The example assumes a Post model with `id`, `title`, and `authorId` columns, an existing User
record for `context.userId`, and the [builder setup](https://pothos-graphql.dev/docs/plugins/prisma/setup) with that context type.

```typescript
import type { Post as PostRow } from '../lib/prisma/client';
import { queryFromInfo } from '@pothos/plugin-prisma';

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    title: t.exposeString('title'),
  }),
});

const CreatePostResult = builder.objectRef<{
  success: boolean;
  post: PostRow | null;
}>('CreatePostResult').implement({
  fields: (t) => ({
    success: t.exposeBoolean('success'),
    post: t.field({
      type: Post,
      nullable: true,
      resolve: (result) => result.post,
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createPost: t.field({
      type: CreatePostResult,
      args: {
        title: t.arg.string({ required: true }),
      },
      resolve: async (parent, args, context, info) => {
        if (!args.title.trim()) {
          return { success: false, post: null };
        }

        const post = await prisma.post.create({
          ...(await queryFromInfo({
            context,
            info,
            path: ['post'],
            awaitSelections: true,
          })),
          data: {
            title: args.title,
            authorId: context.userId,
          },
        });

        return { success: true, post };
      },
    }),
  }),
});
```

The columns and relations the query selected come back on the rows, along with anything you passed
in as `select`, and the rows are typed to match.

To require data even when the client does not request it, pass an initial `select` (or `include`)
to `queryFromInfo`. For example, add `select: { id: true }` beside `path` in the call above to
ensure the returned post includes its ID. When nothing is selected at `path`, the helper returns
that initial selection unchanged, or an empty query object if no initial selection was supplied.

The `path` is followed through fragments in the query, including inline fragments and fragment
spreads that narrow an interface or union to one of its implementations. Every selection of the
field that is found is merged into the query. If several implementations share a field name,
matches whose field returns a different Prisma model are ignored. When you need to target a
specific implementation, a segment can be written as `{ name, type }`. The field then only matches
when it is selected directly, or under a fragment on that type or one of its subtypes:

```typescript
const user = await prisma.user.findUniqueOrThrow({
  where: { id: args.id },
  ...queryFromInfo({
    context,
    info,
    typeName: 'User',
    // only match `appointment` when selected inside `... on AppointmentEntry`
    path: [{ name: 'appointment', type: 'AppointmentEntry' }],
  }),
});

// user is loaded with the selections from `... on AppointmentEntry`,
// and nothing from an `appointment` field on another implementation
```

### Conflicting selections between variants

When a query selects two variants of one model for the same row, either with a fragment on each
under one field, or through a `t.variant` field, the plugin will throw if their type-level
`select`/`include` ask for the same relation with different arguments:

```
PothosValidationError: Type-level selections of Viewer and Admin conflict on relation "posts".
Move the relation arguments to a field-level select on one of the types.
```

Both variants describe one row, so their type-level selections are merged into a single query.

To fix this, keep the relation with its arguments in the `select` of the field that needs it, on
one of the variants. A field-level selection that conflicts with what the row already holds falls
back to a query of its own, rather than failing the request.

### Compare two orderings of one relation

A client may need both the newest and oldest published posts on one author page:

```graphql
query CompareOrderings {
  author(id: 1) {
    newest: posts {
      title
    }
    oldest: posts(oldestFirst: true) {
      title
    }
  }
}
```

The [published-posts field](https://pothos-graphql.dev/docs/plugins/prisma/relations#published-posts-and-profiles) translates those arguments
into different database orderings. Both results must retain their own order: “A guide to
composting” comes first in `newest`, and “Starting a seed library” comes first in `oldest`.
They cannot reuse the same loaded relation. The additional ordering is loaded through a fallback
query. Compare both results and the emitted SQL; a response alone does not establish how the relation was loaded.

Prisma client calls and SQL statements are different measures: a single Prisma query can issue
several SQL statements to load related tables. Compare the emitted SQL without assuming one
statement per Prisma call.
