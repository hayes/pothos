# Scope Auth

## State of proposal

This is a rough overview of a new API for the auth plugin. This will be a breaking change, which
will likely coincide with a 2.0 release (possibly for both the plugin and core).

Method and property names, and associated terminology is all placeholder, this version is mostly to
cover use cases, and integration points.

## Problems with current auth plugin

1. Performance impact is unacceptably high
2. Performance impact applies to all fields rather than just fields that have auth checks
3. Confusing terminology
4. Hard to explain concepts like auth grants
5. No real type checking on auth checks, so mislabeled auth checks won't be caught until there is a
   auth error at runtime.

## Terminology

- scope: A scope is unit of authorization that can be used to authorize a request to resolve a
  field.
- scope map: A map of scope names and scope parameters. This defines the set of scopes that will be
  checked for a field or type to authorize the request the resolve a resource.
- scope loader: A function for loading a scope for loading scope given a scope parameter. Scope
  loaders are ideal for integrating with a permission service, or creating scopes that can be
  customized based in the field or values that they are authorizing.
- scope parameter: A parameter that will be passed to a scope loader. These are the values in the
  authScopes objects.
- scope initializer: The function that creates the scopes or scope loaders for the current request.

## Basic Example

```ts
type CoolPermissions = 'readStuff' | 'updateStuff' | 'readArticle';

const builder = new SchemaBuilder<{
  // Types used for scope parameters
  AuthScopes: {
    loggedIn: boolean;
    admin: boolean;
    deferredAdmin: boolean;
    coolPermission: CoolPermissions;
  };
}>({
  // scope initializer, create the scopes and scope loaders for each request
  authScopes: async (context) => ({
    loggedIn: !!context.User,
    // admin scope, evaluated eagerly
    admin: await context.User.isAdmin(),
    // admin scope loader, evaluated when used
    deferredAdmin: () => context.User.isAdmin(),
    // scope loader with argument
    coolPermission: (perm) => context.permissionService.hasPermission(context.User, perm),
  }),
});

builder.queryType({
  // Scope map describing scopes for any fields on the Query type
  // All Query fields require the user to be logged in
  authScopes: {
    loggedIn: true,
  },
  fields: (t) => ({
    memberMessage: t.string({
      // Scope map for the memberMessage field.
      authScopes: {
        // resolved if the request has any of the following scopes
        // This check is in addition to the type level scope requirements
        admin: true,
        deferredAdmin: true,
        // checks cached per request using the name of the scope + the scope parameter.
        // if multiple fields depend on coolPermission("readStuff") the coolPermission
        // scope loader will only be called once.
        coolPermission: 'readStuff',
      },
      resolve: () => 'hi',
    }),
  }),
});

// Using functions with authScope
builder.objectType(Article, {
  // authScope functions can be used to create and return a scope map based on the values of the thing being authorized
  authScopes: (article, context) => {
    if (article.isDraft()) {
      // Draft articles can only be read by admins
      return {
        admin: true,
      };
    }

    // normal articles can be read by admins and users with the 'readStuff' permission
    return {
      admin: true,
      coolPermission: 'readStuff',
    };
  },
  fields: (t) => ({
    title: t.exposeString('title', {}),
    content: t.exposeString('content', {}),
    viewCount: t.exposeInt('viewCount', {
      // Only admins and authors can view this
      // using a function allows you to customize the auth parameters based on parent, args, context or info
      authScopes: (article, args, context, info) => {
        if (context.User.id === article.author.id) {
          // If user is author, let them see it
          // returning a boolean lets you set auth without specifying other scopes to check
          return true;
        }

        // If the user is not the author, require the admin scope
        return {
          admin: true,
        };
      },
    }),
  }),
});
```

## Use cases

Examples below assume the following builder setup:

```ts
type CoolPermissions = 'readStuff' | 'updateStuff' | 'readArticle';

const builder = new SchemaBuilder<{
  AuthScopes: {
    loggedIn: boolean;
    admin: boolean;
    deferredAdmin: boolean;
    coolPermission: CoolPermissions;
  };
}>({
  authScopes: async (context) => ({
    loggedIn: !!context.User,
    admin: await context.User.isAdmin(),
    deferredAdmin: () => context.User.isAdmin(),
    coolPermission: (perm) => context.permissionService.hasPermission(context.User, perm),
  }),
});
```

### Top level auth on queries and mutations

To add an auth check to root level queries or mutations, add authScopes to the field options:

```ts
builder.queryType({
  fields: (t) => ({
    memberMessage: t.string({
      authScopes: {
        loggedIn: true,
      },
      resolve: () => 'hi',
    }),
  }),
});
```

This will require the request to have the logged in scope. Adding multiple scopes to the authScopes
object will check all the scopes, and if the user has any of the scopes, the request will be
considered authorized for the current field. Subscription and Mutation root fields work the same
way.

### Auth on nested fields

Fields on nested objects can be authorized the same way scopes are authorized on the root types.

```ts
builder.objectType(Article, {
  fields: (t) => ({
    title: t.exposeString('title', {
      authScopes: {
        loggedIn: true,
      },
    }),
  }),
});
```

### Default auth for all fields on types

To apply the same scope requirements to all fields on a type, you can define an authScope map in the
type options rather than on the individual fields.

```ts
builder.objectType(Article, {
  authScopes: {
    loggedIn: true,
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

```ts
builder.objectType(Article, {
  authScopes: {
    loggedIn: true,
  },
  fields: (t) => ({
    title: t.exposeString('title', {}),
    viewCount: t.exposeInt('viewCount', {
      authScopes: {
        admin: true,
      },
    }),
  }),
});
```

To remove the type level scopes for a field, you can use the `ignoreScopesFromType` option:

```ts
builder.objectType(Article, {
  authScopes: {
    loggedIn: true,
  },
  fields: (t) => ({
    title: t.exposeString('title', {
      ignoreScopesFromType: true,
    }),
    content: t.exposeString('title', {}),
  }),
});
```

This will allow non-logged in users to resolve the title, but not the content of an Article.
`ignoreScopesFromType` can be used in conjunction with `authScopes` on a field to completely
overwrite the default scopes.

### Generalized auth functions with field specific arguments

So the scopes we have all been related to information that applies to a full request. In more
complex applications you may not make sense to enumerate all the scopes a request is authorized for
ahead of time. To handle these cases you can define a scope loader which takes a parameter and
dynamically determines if a request is authorized for a scope using that parameter.

One common example of this would be a permission service that can check if a user or request has a
certain permission, and you want to specify the specific permission each field requires.

```ts
builder.queryType({
  fields: (t) => ({
    articles: t.field({
      type: [Article],
      authScopes: {
        coolPermission: 'readArticle',
      },
      resolve: () => Article.getSome(),
    }),
  }),
});
```

In the example above, the authScope map uses the coolPermission scope loader with a parameter of
`readArticle`. The first time a field requests this scope, the coolPermission loader will be called
with `readArticle` as its argument. This scope will be cached, so that if multiple fields request
the same scope, the scope loader will still only be called once.

### Setting scopes that apply for a full request

We have already seen several examples of this. For scopes that apply to a full request like loggedIn
or admin, rather than using a scope loader, the scope initializer can simply use a boolean to
indicate if the request has the given scope. If you know ahead of time that a scope loader will
always return false for a specific request, you can do something like the following to avoid the
additional overhead of running the loader:

```ts
const builder = new SchemaBuilder<{
  AuthScopes: {
    humanPermission: string;
  };
}>({
  authScopes: async (context) => ({
    humanPermission: context.user.isHuman() ? (perm) => context.user.hasPermission(perm) : false,
  }),
});
```

This will ensure that if a request access a field that requests a `humanPermission` scope, and the
request is made by another service or bot, we don't have to run the `hasPermission` check at all for
those requests, since we know it would return false anyways.

### Logical operations on auth scopes (any/all)

By default the the scopes in a scope map are evaluated in parallel, and if the request has any of
the requested scopes, the field will be resolved. In some cases, you may want to require multiple
scopes:

```ts
builder.objectType(Article, {
  authScopes: {
    loggedIn: true,
  },
  fields: (t) => ({
    title: t.exposeString('title', {}),
    viewCount: t.exposeInt('viewCount', {
      authScopes: {
        all: {
          any: {
            admin: true,
            deferredAdmin: true,
          },
          loggedIn: true,
        },
      },
    }),
  }),
});
```

You can use the built in `any` and `all` scope loaders to combine requirements for scopes. The above
example requires a request to have either the `admin` or `deferredAdmin` scopes, and the `loggedIn`
scope. `any` and `all` each take a scope map as their parameters, and can be nested inside each
other.

### Auth that depends on parent value

For cases where the required scopes depend on the value of the requested resource you can use a
function in the `authScopes` option that returns the scope map for the field.

```ts
builder.objectType(Article, {
  fields: (t) => ({
    viewCount: t.exposeInt('viewCount', {
      authScopes: (article, args, context, info) => {
        if (context.User.id === article.author.id) {
          // If user is author, let them see it
          // returning a boolean lets you set auth without specifying other scopes to check
          return true;
        }

        // If the user is not the author, require the admin scope
        return {
          admin: true,
        };
      },
    }),
  }),
});
```

authScope functions of fields will receive the same arguments as the field resolver, and will be
called each time the resolve for the field would be called. This means the same authScope function
could be called multiple time for the same resource if the field is requested multiple times using
an alias.

returning a boolean from an auth scope function is an easy way to allow or disallow a request from
resolving a field without needing to evaluate additional scopes.

### Settings type level scopes based on the parent value

You can also use a function in the authScope option for types. This function will be invoked with
the parent and the context as its arguments, and should return a scope map.

```ts
builder.objectType(Article, {
  authScope: (parent, context) => {
    if (parent.isPublished()) {
      return {
        loggedIn: true,
      };
    }

    return {
      admin: true,
    };
  },
  fields: (t) => ({
    title: t.exposeString('title', {}),
  }),
});
```

The above example uses an authScope function to prevent the fields of an article from being loaded
by non-admins unless they have been published.

### Setting scopes based on the return value of a field

This is a use that may not be supported. The current work around is to move those checks down to the
returned type. The downside of this is that any resulting permission errors will appear on the
fields of the returned type rather than the parent field.

### Granting access to a resource based on how it is accessed

In the original auth plugin for GiraphQL there was a concept of granting authorizations to children.
This was intended for cases where it is not easy to determine if a request should be authorized for
a resource based on the context available while resolving it.

A somewhat contrived example of this might be a schema with 3 types, User, BillingInfo, and
SupportCase. BillingInfo should generally only be available to the user it belongs to, and a support
agent who is helping resolve a case related to that user.

Given a query like:

```graphql
query {
  supportCase(id: 123) {
    user {
      billingInfo {
        address
      }
    }
  }
}
```

You could have a check in the support case that ensures that only an agent assigned to the case has
access. However, when resolving the billingInfo field on a user, you no longer know that you are
resolving this in the context of a support case. In this proposal there is no concept for granting
authorizations. One potential workaround would be to use a new hypothetical scope loader
`requestPath` that can be used to check if a resource was loaded through a specific `path`.

```ts
builder.objectType(User, {
  fields: (t) => ({
    billingInfo: t.field({
      type: BillingInfo,
      authScope: (user, args, context, info) => ({
        requestPath: {
          info,
          paths: ['SupportCase.user', 'SupportCase.longer.path.to.user'],
        },
      }),
      resolve: (user) => user.billingInfo,
    }),
  }),
});
```

This is unlikely to be included in the plugin itself, but shows a potential workaround for a use
case that was previously supported.

### Requiring auth checks

Similar to the original auth plugin there should be options for requiring auth checks in various
places including:

- mutations
- all root level queries
- all fields

### Pre and Post resolve checks

the pre and post resolve checks from the original auth plugin were a very useful tool that was not
fully thought through. They may seem fairly self explanatory, but without a good understanding of
GraphQL can be confusing and raise a lot of questions.

For fields tht resolve to a single, or a list of resources protected by a pre or post resolve check,
the expected behavior was fairly self explanatory. When looking at interfaces and unions, things get
a lot more complicated. If for example in a relay compatible graph, and a User type that implements
the `Node` interface has a preResolve check, you now have 2 options for how to handle the root
`Query.node` field. You can either run the pre resolve check before ANY request to Query.node
regardless of what type is actually being requested, or you can not run it, and Query.node may
resolve a user without running the pre resolve check.

There are several other similar issues with pre and post resolve checks. By removing them, the
behavior of the rest of the auth plugin can become much more intuitive, and all authorization can be
run in one place before a field is resolved, rather than the much more complicated (and
non-performant) implementation that was required to make the original auth plugin work.

Using the new API you would still be able to protect a resource by defining `authScopes` on the
type. The 2 downsides if this are:

1. it happens after resolving the parent field, so if a user should not be able to tell if a
   resource exists or not without permission that check would need to be moved to the parent field
2. Since the checks no longer happen in the parent field, the errors in the response would show up
   for each field that was requested for the resource, rather than only once in the parent field.

### Interfaces

Interfaces can define auth scopes on their fields the same way objects do.

I am not sure about type level authScopes on interfaces. I would need to think through how those
would be applied (only to the interfaces fields, or all fields of objects that implement the
interface).

### Unions

Since there are no pre and post resolve checks, and all authorization logic is now based on fields,
unions do not directly interact with the auth plugin, and do not have their own authScopes

## When checks are run, and how things are cached

### Scope Initializer

The scope initializer would be run once the first time a field protected by auth scopes is resolved,
its result will be cached for the current request.

### authScopes functions on fields

when using a function for `authScopes` on a field, the function will be run each time the field is
resolved, since it has access to all the arguments passed to the resolver

### authScopes functions on types

when using a function for `authScopes` on a type, the function will be run the once for each
instance of that type in the response. It will be run lazily when the first field for that object is
resolved, and its result will be cached and reused by all fields for that instance of the type.

### scope loaders

Scope loaders will be run run whenever a field requires the corresponding scope with a unique
parameter. The scope loader results are cached per request based on a combination of the name of the
scope, and its parameter.

### grantScope on field

`grantScopes` on a field will run after the field is resolved, and is not cached

### grantScope on type

`grantScopes` on a type (object or interface) will run when the first field on the type is resolved.
It's result will be cached and reused for each field of the same instance of the type.

```ts
builder.queryType({
  fields: (t) => ({
    article: t.field({
      type: Article,
      authScopes: {
        coolPermission: 'readStuff',
      },
      grantScopes: ['readArticle'],
      // or
      grantScopes: (parent, args, context, info) => ['readArticle'],
      resolve: () => 'hi',
    }),
  }),
});

builder.objectType(Article, {
  grantScopes: (parent, context) => {
    return context.user.canRead() ? ['readArticle'] : []
  },
  fields: (t) => ({
    content: t.exposeString('content', {
      {
      authScopes: {
        // If grantScopes  on type, or grantScopes on parent field included readArticle, allow this field
        $granted: 'readArticle',
      }
    }),
  }),
});
```
