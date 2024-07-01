# Auth Plugin

The scope auth plugin aims to be a general purpose authorization plugin that can handle a wide
variety of authorization use cases, while incurring a minimal performance overhead.

## Usage

### Install

```bash
yarn add @pothos/plugin-scope-auth
```

#### IMPORTANT

When using `scope-auth` with other plugins, the `scope-auth` plugin should generally be listed first
to ensure that other plugins that wrap resolvers do not execute before the `scope-auth` logic.
However, exceptions do exist where it is desirable for a plugin to run before `scope-auth`. For
instance, putting the [relay plugin](https://pothos-graphql.dev/docs/plugins/relay) before the
`scope-auth` plugin results in the `authScopes` function correctly receiving parsed `globalID`s.

### Setup

```typescript
import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';

type MyPerms = 'readStuff' | 'updateStuff' | 'readArticle';

const builder = new SchemaBuilder<{
  // Types used for scope parameters
  AuthScopes: {
    public: boolean;
    employee: boolean;
    deferredScope: boolean;
    customPerm: MyPerms;
  };
}>({
  plugins: [ScopeAuthPlugin],
  scopeAuth: {
    // Recommended when using subscriptions
    // when this is not set, auth checks are run when event is resolved rather than when the subscription is created
    authorizeOnSubscribe: true,
    // scope initializer, create the scopes and scope loaders for each request
    authScopes: async (context) => ({
      public: !!context.User,
      // eagerly evaluated scope
      employee: await context.User.isEmployee(),
      // evaluated when used
      deferredScope: () => context.User.isEmployee(),
      // scope loader with argument
      customPerm: (perm) => context.permissionService.hasPermission(context.User, perm),
    }),
  },
});
```

In the above setup, We import the `scope-auth` plugin, and include it in the builders plugin list.
We also define 2 important things:

1. The `AuthScopes` type in the builder `SchemaTypes`. This is a map of types that define the types
   used by each of your scopes. We'll see how this is used in more detail below.

2. The `scope initializer` function, which is the implementation of each of the scopes defined in
   the type above. This function returns a map of either booleans \(indicating if the request has
   the scope\) or functions that load the scope \(with an optional parameter\).

The names of the scopes \(`public`, `employee`, `deferredScope`, and `customPerm`\) are all
arbitrary, and are not part of the plugin. You can use whatever scope names you prefer, and can add
as many you need.

### Using a scope on a field

```typescript
builder.queryType({
  fields: (t) => ({
    message: t.string({
      authScopes: {
        public: true,
      },
      resolve: () => 'hi',
    }),
  }),
});
```

## Terminology

A lot of terms around authorization are overloaded, and can mean different things to different
people. Here is a short list of a few terms used in this document, and how they should be
interpreted:

- `scope`: A scope is unit of authorization that can be used to authorize a request to resolve a
  field.

- `scope map`: A map of scope names and scope parameters. This defines the set of scopes that will
  be checked for a field or type to authorize the request the resolve a resource.

- `scope loader`: A function for dynamically loading scope given a scope parameter. Scope loaders
  are ideal for integrating with a permission service, or creating scopes that can be customized
  based in the field or values that they are authorizing.

- `scope parameter`: A parameter that will be passed to a scope loader. These are the values in the
  authScopes objects.

- `scope initializer`: The function that creates the scopes or scope loaders for the current
  request.

While this plugin uses `scopes` as the term for it's authorization mechanism, this plugin can easily
be used for role or permission based schemes, and is not intended to dictate a specific philosophy
around how to authorize requests/access to resources.

## Use cases

Examples below assume the following builder setup:

```typescript
const builder = new SchemaBuilder<{
  // Types used for scope parameters
  AuthScopes: {
    public: boolean;
    employee: boolean;
    deferredScope: boolean;
    customPerm: MyPerms;
  };
}>({
  plugins: [ScopeAuthPlugin],
  authScopes: async (context) => ({
    public: !!context.User,
    employee: await context.User.isEmployee(),
    deferredScope: () => context.User.isEmployee(),
    customPerm: (perm) => context.permissionService.hasPermission(context.User, perm),
  }),
});
```

### Top level auth on queries and mutations

To add an auth check to root level queries or mutations, add authScopes to the field options:

```typescript
builder.queryType({
  fields: (t) => ({
    internalMessage: t.string({
      authScopes: {
        employee: true,
      },
      resolve: () => 'hi',
    }),
  }),
});
```

This will require the requests to have the `employee` scope. Adding multiple scopes to the
`authScopes` object will check all the scopes, and if the user has any of the scopes, the request
will be considered authorized for the current field. Subscription and Mutation root fields work the
same way.

### Auth on nested fields

Fields on nested objects can be authorized the same way scopes are authorized on the root types.

```typescript
builder.objectType(Article, {
  fields: (t) => ({
    title: t.exposeString('title', {
      authScopes: {
        employee: true,
      },
    }),
  }),
});
```

### Default auth for all fields on types

To apply the same scope requirements to all fields on a type, you can define an `authScope` map in
the type options rather than on the individual fields.

```typescript
builder.objectType(Article, {
  authScopes: {
    public: true,
  },
  fields: (t) => ({
    title: t.exposeString('title', {}),
    content: t.exposeString('content', {}),
  }),
});
```

### Overwriting default auth on field

In some cases you may want to use default auth scopes for a type, but need to change the behavior
for one specific field.

To add additional requirements for a specific field you can simply add additional scopes on the
field itself.

```typescript
builder.objectType(Article, {
  authScopes: {
    public: true,
  },
  fields: (t) => ({
    title: t.exposeString('title', {}),
    viewCount: t.exposeInt('viewCount', {
      authScopes: {
        employee: true,
      },
    }),
  }),
});
```

To remove the type level scopes for a field, you can use the `skipTypeScopes` option:

```typescript
builder.objectType(Article, {
  authScopes: {
    public: true,
  },
  fields: (t) => ({
    title: t.exposeString('title', {
      skipTypeScopes: true,
    }),
    content: t.exposeString('title', {}),
  }),
});
```

This will allow non-logged in users to resolve the title, but not the content of an Article.
`skipTypeScopes` can be used in conjunction with `authScopes` on a field to completely overwrite the
default scopes.

### Running scopes on types rather than fields

By default, all auth scopes are tested before a field resolves. This includes both scopes defined on
a type and scopes defined on a fields. When scopes for a `type` fail, you will end up with an error
for each field of that type. Type level scopes are only executed once, but the errors are emitted
for each affected field.

The behavior may not be desireable for all users. You can set `runScopesOnType` to true, either on
object types, or in the `scopeAuth` options of the builder

```typescript
const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: {
    loggedIn: boolean;
  };
}>({
  scopeAuth: {
    // Affects all object types (Excluding Query, Mutation, and Subscription)
    runScopesOnType: true,
    authScopes: async (context) => ({
      loggedIn: !!context.User,
    }),
  },
  plugins: [ScopeAuthPlugin],
});

builder.objectType(Article, {
  runScopesOnType: true,
  authScopes: {
    readArticle: true,
  },
  fields: (t) => ({
    title: t.exposeString('title', {
      // this will not have any affect because type scopes are not evaluated at the field level
      skipTypeScopes: true,
    }),
    content: t.exposeString('title', {}),
  }),
});
```

Enabling this has a couple of limitations:

1. THIS DOES NOT CURRENTLY WORK WITH `graphql-jit`. This options uses the `isTypeOf` function, but
   `graphql-jit` does not support async `isTypeOf`, and also does not correctly pass the context
   object to the isTypeOf checks. Until this is resolved, this option will not work with
   `graphql-jit`.

2. Fields of types that set `runScopesOnType` to true will not be able to use `skipTypeScopes` or
   `skipInterfaceScopes`.

### Generalized auth functions with field specific arguments

The scopes we have covered so far have all been related to information that applies to a full
request. In more complex applications you may not make sense to enumerate all the scopes a request
is authorized for ahead of time. To handle these cases you can define a scope loader which takes a
parameter and dynamically determines if a request is authorized for a scope using that parameter.

One common example of this would be a permission service that can check if a user or request has a
certain permission, and you want to specify the specific permission each field requires.

```typescript
builder.queryType({
  fields: (t) => ({
    articles: t.field({
      type: [Article],
      authScopes: {
        customPerm: 'readArticle',
      },
      resolve: () => Article.getSome(),
    }),
  }),
});
```

In the example above, the authScope map uses the customPerm scope loader with a parameter of
`readArticle`. The first time a field requests this scope, the customPerm loader will be called with
`readArticle` as its argument. This scope will be cached, so that if multiple fields request the
same scope, the scope loader will still only be called once.

The types for the parameters you provide for each scope are based on the types provided to the
builder in the `AuthScopes` type.

### Customizing error messages

Error messages (and error instances) can be customized either globally or on specific fields.

#### Globally

```typescript
const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: {
    loggedIn: boolean;
  };
}>({
  scopeAuth: {
    treatErrorsAsUnauthorized: true,
    unauthorizedError: (parent, context, info, result) => new Error(`Not authorized`),
    authScopes: async (context) => ({
      loggedIn: !!context.User,
    }),
  },
  plugins: [ScopeAuthPlugin],
});
```

The `unauthorizedError` callback will be called with the parent, context, and info object of the
unauthorized field. It will also include a 4th argument `result` that has the default message for
this type of failure, and a `failure` property with some details about what caused the field to be
unauthorized. This callback can either return an `Error` instance (or an instance of a class that
extends `Error`), or a `string`. If a string is returned, it will be converted to a
`ForbiddenError`.

The `treatErrorsAsUnauthorized` option changes how errors in authorization functions are handled. By
default errors are not caught by the plugin, and will act as if thrown directly from the resolver.
This means that thrown errors bypass the `unauthorizedError` callback, and will cause requests to
fail even when another scope in an `$any` passes.

Setting `treatErrorsAsUnauthorized` will cause errors to be caught and treated as if the scope was
not authorized.

#### Surfacing errors thrown in authorization checks

When `treatErrorsAsUnauthorized` is set to true, errors are caught and attached to the `result`
object in the `unauthorizedError` callback. This allows you to surface the error to the client.

For example, if you want to re-throw errors thrown by authorization functions you could do this by
writing a custom `unauthorizedError` callback like this:

```typescript
import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin, { AuthFailure, AuthScopeFailureType } from '@pothos/plugin-scope-auth';

// Find the first error and re-throw it
function throwFirstError(failure: AuthFailure) {
  // Check if the failure has an error attached to it and re-throw it
  if ('error' in failure && failure.error) {
    throw failure.error;
  }

  // Loop over any/all scopes and see if one of their children has an error to throw
  if (
    failure.kind === AuthScopeFailureType.AnyAuthScopes ||
    failure.kind === AuthScopeFailureType.AllAuthScopes
  ) {
    for (const child of failure.failures) {
      throwFirstError(child);
    }
  }
}

const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: {
    loggedIn: boolean;
  };
}>({
  scopeAuth: {
    treatErrorsAsUnauthorized: true,
    unauthorizedError: (parent, context, info, result) => {
      // throw an error if it's found
      throwFirstError(result.failure);
      // throw a fallback error if no error was found
      return new Error(`Not authorized`);
    },
  },
  plugins: [ScopeAuthPlugin],
  authScopes: async (context) => ({
    loggedIn: !!context.User,
  }),
});
```

#### On individual fields

```typescript
builder.queryType({
  fields: (t) => ({
    example: t.string({
      authScopes: { loggedIn: true },
      unauthorizedError: (parent, args, context, info, result) =>
        new Error("You must be logged in to query the 'example' field"),
      resolve: () => 'example',
    }),
  }),
});
```

### Returning a custom value when unauthorized

In some cases you may want to return null, and empty array, throw a custom error, or return a custom
result when a user is not authorized. To do this you can add a `unauthorizedResolver` option to your
field.

```typescript
builder.queryType({
  fields: (t) => ({
    articles: t.field({
      type: [Article],
      authScopes: {
        customPerm: 'readArticle',
      },
      resolve: () => Article.getSome(),
      unauthorizedResolver: () => [],
    }),
  }),
});
```

In the example above, if a user is not authorized they will simply receive an empty array in the
response. The `unauthorizedResolver` option takes the same arguments as a resolver, but also
receives a 5th argument that is an instance of `ForbiddenError`.

### Setting scopes that apply for a full request

We have already seen several examples of this. For scopes that apply to a full request like `public`
or `employee`, rather than using a scope loader, the scope initializer can simply use a boolean to
indicate if the request has the given scope. If you know ahead of time that a scope loader will
always return false for a specific request, you can do something like the following to avoid the
additional overhead of running the loader:

```typescript
const builder = new SchemaBuilder<{
  AuthScopes: {
    humanPermission: string;
  };
}>({
  plugins: [ScopeAuthPlugin],
  authScopes: async (context) => ({
    humanPermission: context.user.isHuman() ? (perm) => context.user.hasPermission(perm) : false,
  }),
});
```

This will ensure that if a request access a field that requests a `humanPermission` scope, and the
request is made by another service or bot, we don't have to run the `hasPermission` check at all for
those requests, since we know it would return false anyways.

### Change context types based on scopes

Sometimes you need to change your context typings depending on the applied scopes. You can provide
custom context for your defined scopes and use the `authField` method to access the custom context:

```typescript
type Context = {
  user: User | null;
};

const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: {
    loggedIn: boolean;
  };
  AuthContexts: {
    loggedIn: Context & { user: User };
  };
}>({
  plugins: [ScopeAuthPlugin],
  authScopes: async (context) => ({
    loggedIn: !!context.user,
  }),
});

builder.queryField('currentId', (t) =>
  t.authField({
    type: 'ID',
    authScopes: {
      loggedIn: true,
    },
    resolve: (parent, args, context) => context.user.id,
  }),
);
```

Some plugins contribute field builder methods with additional functionality that may not work with
`t.authField`. In order to work with those methods, there is also a `t.withAuth` method that can be
used to return a field builder with authScopes predefined.

```typescript
type Context = {
  user: User | null;
};

const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: {
    loggedIn: boolean;
  };
  AuthContexts: {
    loggedIn: Context & { user: User };
  };
}>({
  plugins: [ScopeAuthPlugin],
  authScopes: async (context) => ({
    loggedIn: !!context.user,
  }),
});

builder.queryField('viewer', (t) =>
  t
    .withAuth({
      loggedIn: true,
    })
    .prismaField({
      type: User,
      resolve: (query, root, args, ctx) =>
        prisma.findUniqueOrThrow({
          ...query,
          where: { id: ctx.user.id },
        }),
    }),
);
```

### Logical operations on auth scopes \(any/all\)

By default the the scopes in a scope map are evaluated in parallel, and if the request has any of
the requested scopes, the field will be resolved. In some cases, you may want to require multiple
scopes:

```typescript
builder.objectType(Article, {
  fields: (t) => ({
    title: t.exposeString('title', {}),
    viewCount: t.exposeInt('viewCount', {
      authScopes: {
        $all: {
          $any: {
            employee: true,
            deferredScope: true,
          },
          public: true,
        },
      },
    }),
  }),
});
```

You can use the built in `$any` and `$all` scope loaders to combine requirements for scopes. The
above example requires a request to have either the `employee` or `deferredScope` scopes, and the
`public` scope. `$any` and `$all` each take a scope map as their parameters, and can be nested
inside each other.

You can change the default strategy used for top level auth scopes by setting the `defaultStrategy`
option in the builder (defaults to `any`):

```typescript
const builder = new SchemaBuilder<{
  Context: {
    user: User | null;
  };
  AuthScopes: {
    loggedIn: boolean;
  };
  DefaultAuthStrategy: 'all';
}>({
  plugins: [ScopeAuthPlugin],
  scopeAuthOptions: {
    defaultStrategy: 'all',
  },
  authScopes: async (context) => ({
    loggedIn: !!context.user,
  }),
});
```

### Auth that depends on parent value

For cases where the required scopes depend on the value of the requested resource you can use a
function in the `authScopes` option that returns the scope map for the field.

```typescript
builder.objectType(Article, {
  fields: (t) => ({
    viewCount: t.exposeInt('viewCount', {
      authScopes: (article, args, context, info) => {
        if (context.User.id === article.author.id) {
          // If user is author, let them see it
          // returning a boolean lets you set auth without specifying other scopes to check
          return true;
        }

        // If the user is not the author, require the employee scope
        return {
          employee: true,
        };
      },
    }),
  }),
});
```

authScope functions on fields will receive the same arguments as the field resolver, and will be
called each time the resolve for the field would be called. This means the same authScope function
could be called multiple time for the same resource if the field is requested multiple times using
an alias.

Returning a boolean from an auth scope function is an easy way to allow or disallow a request from
resolving a field without needing to evaluate additional scopes.

### Setting type level scopes based on the parent value

You can also use a function in the authScope option for types. This function will be invoked with
the parent and the context as its arguments, and should return a scope map.

```typescript
builder.objectType(Article, {
  authScope: (parent, context) => {
    if (parent.isPublished()) {
      return {
        public: true,
      };
    }

    return {
      employee: true,
    };
  },
  fields: (t) => ({
    title: t.exposeString('title', {}),
  }),
});
```

The above example uses an authScope function to prevent the fields of an article from being loaded
by non employees unless they have been published.

### Setting scopes based on the return value of a field

This is a use that is not currently supported. The current work around is to move those checks down
to the returned type. Combining this with `runScopesOnType` should work for most cases.

### Granting access to a resource based on how it is accessed

In some cases, you may want to grant a request scopes to access certain fields on a child type. To
do this you can use `$granted` scopes.

```typescript
builder.queryType({
  fields: (t) => ({
    freeArticle: t.field({
      grantScopes: ['readArticle'],
      // or
      grantScopes: (parent, args, context, info) => ['readArticle'],
    }),
  }),
});

builder.objectType(Article, {
  authScopes: {
    public: true,
    $granted: 'readArticle',
  }
  fields: (t) => ({
    title: t.exposeString('title', {}),
  }),
});
```

In the above example, the fields of the `Article` type normally require the `public` scope granted
to logged in users, but can also be accessed with the `$granted` scope `readArticle`. This means
that if the field that returned the Article "granted" the scope, the article ran be read. The
`freeArticle` field on the `Query` type grants this scope, allowing anyone querying that field to
access fields of the free article. `$granted` scopes are separate from other scopes, and do not give
a request access to normal scopes of the same name. `$granted` scopes are also not inherited by
nested children, and would need to be explicitly passed down for each field if you wanted to grant
access to nested children.

### Reusing checks for multiple, but not all fields

You may have cases where groups of fields on a type are accessible using some shared condition. This
is another case where `$granted` scopes can be helpful.

```typescript
builder.objectType(Article, {
  grantScopes: (article, context) => {
    if (context.User.id === article.author.id) {
      return ['author', 'readArticle'];
    }

    if (article.isDraft()) {
      return [];
    }

    return ['readArticle'];
  },
  fields: (t) => ({
    title: t.exposeString('title', {
      authScopes: {
        $granted: 'readArticle',
      },
    }),
    content: t.exposeString('content', {
      authScopes: {
        $granted: 'readArticle',
      },
    }),
    viewCount: t.exposeInt('viewCount', {
      authScopes: {
        $granted: 'author',
      },
    }),
  }),
});
```

In the above example, `title`, `content`, and `viewCount` each use `$granted` scopes. In this case,
rather than scopes being granted by the parent field, they are granted by the the Article type
itself. This allows the access to each field to change based on some dynamic conditions \(if the
request is from the author, and if the article is a draft\) without having to duplicate that logic
in each individual field.

### Interfaces

Interfaces can define auth scopes on their fields the same way objects do. Fields for a type will
run checks for each interface it implements separately, meaning that a request would need to satisfy
the scope requirements for each interface separately before the field is resolved.

Object types can set `skipInterfaceScopes` to `true` to skip interface checks when resolving fields
for that Object type.

### Cache keys

Auth scopes by default are cached based on the identity of the scope parameter. This works great for
statically defined scopes, and scopes that take primitive values as their parameters. If you define
auth scopes that take complex objects, and create those objects in a scope function (based on
arguments, or parent values) You won't get cache hits on those checks.

To work around this, you can provide a `cacheKey` option to the builder for generating a cache key
from your scope checks.

```typescript
const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: {
    loggedIn: boolean;
  };
}>({
  scopeAuth: {
    cacheKey: (val) => JSON.stringify(val),
    authScopes: async (context) => ({
      loggedIn: !!context.User,
    }),
  },
  plugins: [ScopeAuthPlugin],
});
```

Above we are using `JSON.stringify` to generate a key. This will work for most complex objects, but
you may want to consider something like `faster-stable-stringify` that can handle circular
references, and swill always produce the same output regardless of the order of properties.

## When checks are run, and how things are cached

### Scope Initializer

The scope initializer would be run once the first time a field protected by auth scopes is resolved,
its result will be cached for the current request.

### authScopes functions on fields

When using a function for `authScopes` on a field, the function will be run each time the field is
resolved, since it has access to all the arguments passed to the resolver

### authScopes functions on types

When using a function for `authScopes` on a type, the function will be run the once for each
instance of that type in the response. It will be run lazily when the first field for that object is
resolved, and its result will be cached and reused by all fields for that instance of the type.

### scope loaders

Scope loaders will be run run whenever a field requires the corresponding scope with a unique
parameter. The scope loader results are cached per request based on a combination of the name of the
scope, and its parameter.

### grantScope on field

`grantScopes` on a field will run after the field is resolved, and is not cached

### grantScope on type

`grantScopes` on a type \(object or interface\) will run when the first field on the type is
resolved. It's result will be cached and reused for each field of the same instance of the type.

## API

### Types

- `AuthScopes`: `extends {}`. Each property is the name of its scope, each value is the type for the
  scopes parameter.

- `ScopeLoaderMap`: Object who's keys are scope names \(from `AuthScopes`\) and whos values are
  either booleans \(indicating whether or not the request has the scope\) or function that take a
  parameter \(type from `AuthScope`\) and return `MaybePromise<boolean>`

- `ScopeMap`: A map of scope names to parameters. Based on `AuthScopes`, may also contain `$all`,
  `$any` or `$granted`.

### Builder

- `authScopes`: \(context: Types\['Context'\]\) =&gt; `MaybePromise<ScopeLoaderMap<Types>>`

### Object and Interface options

- `authScopes`: `ScopeMap` or `function`, accepts `parent` and `context` returns
  `MaybePromise<ScopeMap>`

- `grantScopes`: `function`, accepts `parent` and `context` returns `MaybePromise<string[]>`

### Field Options

- `authScopes`: `ScopeMap` or `function`, accepts same arguments as resolver, returns
  `MaybePromise<ScopeMap>`

- `grantScopes`: `string[]` or `function`, accepts same arguments as resolver, returns
  `MaybePromise<string[]>`

- `skipTypeScopes`: `boolean`
- `skipInterfaceScopes`: `boolean`

### toSchema options

- `disableScopeAuth`: disable the scope auth plugin. Useful for testing.
