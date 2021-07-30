---
name: Prisma
menu: Plugins
---

# Prisma

This plugin provides tighter integration with prisma, making it easier to define prisma based object types, and helps solve n+1 queries for relations.

## Disclaimers

This plugin is experimental, and may have some breaking changes in the future.

This plugin is NOT required to build graphs backed by prisma models, and I would not recommend using it unless you have a solid understanding of how it will construct queries.

This plugin will make it very easy to have common queries be resolved through a single prisma query \(prisma may still turn this into multiple SQL queries\), and provides reasonable, predictable and safe fallbacks for more complex queries and edge cases.

The way this plugin resolves queries is designed to be efficient, while still being predictable and easy to understand. Tools that try to automatically generate queries are often hard to understand and reason about, so this plugin tries to make things as clear as possible, by limiting generated queries to an absolute minimum.

## Compatibility

Most plugins should work as expected with this plugin with a couple of exceptions:

* Dataloader: The ideas behind dataloader and the prisma plugin are not very compatible. The prisma

  plugin works by pulling in as much data as possible through a single query. This makes it very

  challenging to find ways to take advantage of a dataloader cache, and attempts to do so would

  likely result in hard to predict behavior, or weird edge cases.

* Relay: The relay plugin will work with this plugin, but will not be able to take advantage of

  pre-loaded queries in all cases. There will be some additional integration added in the near

  future to improve this experience.

### GiraphQL + Prisma without a plugin

If you just want learn about the plugin, feel free to skip this section, but understanding how to use prisma without a plugin may be useful for evaluating if this plugin is a good fit for your use case.

Using prisma and GiraphQL together without a plugin is fairy straight forward using the`builder.objectRef` method.

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

This sets up User, and Post objects with a few fields, and a `me` query that returns the current user. There are a few things to note in this setup:

1. We split up the `builder.objectRef` and the `implement` calls, rather than calling

   `builder.objectRef(...).implement(...)`. This prevents typescript from getting tripped up by the

   circular references between posts and users.

2. We use rejectOnNotFound with our `findUnique` calls because those fields are not nullable.

   Without this option, prisma will return a null if the object is not found. An alternative is to

   mark these fields as nullable.

3. The refs to our object types are called `UserObject` and `PostObject`, this is because `User` and

   `Post` are the names of the types imported from prisma. We could instead alias the types when we

   import them so we can name the refs to our GraphQL types after the models.

This setup is fairly simple, but it is easy to see the n+1 issues we might run into. Prisma helps with this by batching queries together, but there are also things we can do in our implementation to improve things.

One thing we could do if we know we will usually be loading the author any time we load a post is to make the author part of shape required for a post:

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

We may not always want to query for the author though, so we could make the author optional and fall back to using a query if it was not provided by the parent resolver:

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

With this setup, a parent resolver has the option to include the author, but we have a fallback incase it does not.

There are other patterns like dataloaders than can be used to reduce n+1 issues, and make your graph more efficient, but they are too complex to describe here.

## Usage

### Install

```bash
yarn add @giraphql/plugin-prisma
```

### Setup

```typescript
import SchemaBuilder from '@giraphql/core';
import { PrismaClient } from '@prisma/client';
import PrismaPlugin from '@giraphql/plugin-prisma';

const prisma = new PrismaClient({});

const builder = new SchemaBuilder<
    PrismaClient: typeof prisma;
>({
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
  },
});
```

### Full Example

There is a more thorough step by step breakdown of how to use this plugin bellow, but here is a quick example of what ussage might look like:

```typescript
builder.prismaObject('User', {
  findUnique: (user) => ({ id: user.id }),
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    posts: t.relation('posts', {
      args: {
        oldestFirst: t.arg.boolean(),
      },
      query: (args) => ({
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

Given this schema, you would be able to resolve a query like the following with a single prisma query \(which will still result in a few optimized SQL queries\).

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

Will result in 2 calls to primsa, one to resolve everything except `oldPosts`, and a second to resolve everything inside `oldPosts`. Prisma can only resolve each relation once in a single query, so we need a separate to handle the second `posts` relation. This may seem slightly magical, but should be predictable and hopefully understandable after reading the documentation below.

### Creating some types with `builder.prismaObject`

`builder.prismaObject` takes 2 arguments:

1. `model`: The name of the model you are creating a type for
2. `options`: options for the type being created, this is very similar to the options for any other

   object type

```typescript
builder.prismaObject('User', {
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

So far, this is just creating some simple object types. They work just like any other object type in GiraphQL. They main advantage of this is that we get the type information without using object refs, or needing imports from primsa client.

The `findUnique` option is described more below.

### Adding prisma fields to non-prisma objects \(including Query and Mutation\)

There is a new `t.prismaField` method which can be used to define fields that resolve to your prisma types:

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

This method works just like the normal `t.field` method with a couple of differences:

1. The `type` option should be the name of one of your prisma models or `['Model']` for a list

   field.

2. The `resolve` function has a new first argument `query` which should be spread into query prisma

   query. This will be used to load data for nested relationships.

You do not need to use this method, and the `builder.prismaObject` method returns an object ref than can be used like any other object ref \(with `t.field`\), but using `t.prismaField` will allow you to take advantage of more effient queries.

The `query` object will contain an `include` object to pre-load data needed to resolve nested parts of the current query. This is based on fields defined with `t.relation` described below.

If there are no fields using `t.relation` in your query, everything is resolved exactly as it would be without this plugin.

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

builder.prismaObject('Post', {
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

`t.relation` defines a field that can be pre-loaded by a parent resolver, and most of the time, the `resolve` function will NOT be called. This is VERY IMPORTANT to understand, because it is the biggest place where you can introduce inconsistencies into your API with this plugin. The `resolve` function is used to load the relationship if parent resolver did not pre-load the data needed to resolve the field. This happens for a number of reasons:

1. The parent object was not loaded through a field defined with `t.prismaField`, or `t.relation`
2. The `query` object for the parent field was not spread into the query
3. The graphql query requested multiple fields that depended on the same relationship \(described

   more below\)

These are all okay, and expected situations. Graphql APIs are very flexible, and magically pushing everything into a single query is impossible for arbitrary queries. This is why we have a `resolve` function than can load the relation IF it was not already loaded by the parent.

Like `t.prismaField`, the `resolve` function now as a new first argument that is a query that should be spread into the query, and is used to load nested relationships.

### Find Unique

Because the `resolve` function is only used as a fallback, it is harder to test, and if done incorrectly can introduce inconsistencies. While it shouldn't be too hard to get right, it might be better to avoid it entirely. To do this, we can let the Prisma plugin generate these resolve functions for you in a consistent and predictable way. We can do this by providing a findUnique option for our object type. Defining a `findUnique` that is not null, will make `resolve` optional.

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

This greatly simplifies our object types. In these cases, the fallback resolve functions will re-load the current object using the `findUnique` as the where clause, and then `include` the relation for the current field. This can produce a slightly less efficient query than a manual implementation because the parent object is re-loaded first, but it will batch multiple relationships into one query, and the findUnique queries should be very fast.

For example, if a `User` was loaded without pre-loading, and both a `posts` and a `profile` relation where requested, the generated prisma call would be something like:

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

So far we have been describing very simple queries without any arguments, filtering, or sorting. For `t.prismaField` definitions, you can add arguments to your field like normal, and pass them into your prisma query as needed. For `t.relation` the flow is slightly different because we need to make sure we are loading the right data if we are pre-loading data in a parent resolver. We do this by adding a `query` option to our field options.

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
      query: (args) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
    }),
  }),
});
```

This query will be part of the `query` that gets passed into the first argument of `resolve` function for `t.realtion` and `t.prismaField` based fields, and inlude things like `where`, `skip`, `take`, `orderBy`, etc.

If your field has a `resolve` method the generated `query` will be passed in as part of the first arg to your resolve function

```typescript
builder.prismaObject('Post', {
  findUnique: null,
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author', {
      args: {
        oldestFirst: t.arg.boolean(),
      },
      query: (args) => ({
        orderBy: {
          createdAt: args.oldestFirst ? 'asc' : 'desc',
        },
      }),
      // query here will contain the orderBy (and any other properties returned by the query method)
      resolve: (query, post) =>
        db.user.findUnique({ ...query, rejectOnNotFound: true, where: { id: post.authorId } }),
    }),
  }),
});
```

It is IMPORTANT to put all your filtering and sorting into the query method rather than your resovler because the resolver is only used as fallback, and any filtering that does not exist in the query method will not be applied correctly. If you have a where in both your query and your resolver, you will need to ensure these are merged correctly. It is generally better NOT to use a custom resolver.

