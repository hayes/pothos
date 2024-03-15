# Federation Plugin

A plugin for building subGraphs that are compatible with
[Apollo Federation 2](https://www.apollographql.com/docs/federation/).

## Usage

This page will describe the basics of the Pothos API for federation, but will not cover detailed
information on how federation works, or what all the terms on this page mean. For more general
information on federation, see the
[official docs](https://www.apollographql.com/docs/federation/v2/)

### Install

You will need to install the plugin, as well as the directives plugin (`@pothos/plugin-directives`)
and `@apollo/subgraph`

```bash
yarn add @pothos/plugin-federation @pothos/plugin-directives @apollo/subgraph
```

You will likely want to install @apollo/server as well, but it is not required if you want to use a
different server

```bash
yarn add @apollo/server
```

### Setup

```typescript
import DirectivePlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';
const builder = new SchemaBuilder({
  // If you are using other plugins, the federation plugin should be listed after plugins like auth that wrap resolvers
  plugins: [DirectivePlugin, FederationPlugin],
});
```

### Defining entities

Defining entities for you schema is a 2 step process. First you will need to define an object type
as you would normally, then you can convert that object type to an entity by providing a `key` (or
`keys`), and a method to load that entity.

```typescript
const UserType = builder.objectRef<User>('User').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    username: t.exposeString('username'),
  }),
});

builder.asEntity(UserType, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: (user, users) => users.find(({ id }) => user.id === id),
});
```

`keys` are defined using `builder.selection`. This method _MUST_ be called with a generic argument
that defines the types for any fields that are part of the key. `key` may also be an array.
`resolveReference` will be called with the type used by the `key` selection.

Entities are Object types that may be extended with or returned by fields in other services.
`builder.asEntity` describes how the Entity will be loaded when used by another services. The `key`
select (or selection) should use the types of scalars your server will produce for inputs. For
example, Apollo server will convert all ID fields to `string`s, even if resolvers in other services
returns IDs as numbers.

### Extending external entities

External entities can be extended by calling `builder.externalRef`, and then calling implement on
the returned ref.

`builder.externalRef` takes the name of the entity, a selection (using `builder.selection`, just
like a `key` on an entity object), and a resolve method that loads an object given a `key`. The
return type of the resolver is used as the backing type for the ref, and will be the type of the
`parent` arg when defining fields for this type. The `key` also describes what fields will be
selected from another service to use as the `parent` object in resolvers for fields added when
implementing the `externalRef`.

```typescript
const ProductRef = builder.externalRef(
  'Product',
  builder.selection<{ upc: string }>('upc'),
  (entity) => {
    const product = inventory.find(({ upc }) => upc === entity.upc);

    // extends the entity ({upc: string}) with other product details available in this service
    return product && { ...entity, ...product };
  },
);

ProductRef.implement({
  // Additional external fields can be defined here which can be used by `requires` or `provides` directives
  externalFields: (t) => ({
    price: t.float(),
    weight: t.float(),
  }),
  fields: (t) => ({
    // exposes properties added during loading of the entity above
    upc: t.exposeString('upc'),
    inStock: t.exposeBoolean('inStock'),
    shippingEstimate: t.float({
      // fields can add a `requires` directive for any of the externalFields defined above
      // which will be made available as part of the first arg in the resolver.
      requires: builder.selection<{ weight?: number; price?: number }>('price weight'),
      resolve: (data) => {
        // free for expensive items
        if ((data.price ?? 0) > 1000) {
          return 0;
        }
        // estimate is based on weight
        return (data.weight ?? 0) * 0.5;
      },
    }),
  }),
});
```

To set the `resolvable` property of an external field to `false`, can use `builder.keyDirective`:

```ts
const ProductRef = builder.externalRef(
  'Product',
  builder.keyDirective(builder.selection<{ upc: string }>('upc'), false),
);
```

### Adding a provides directive

To add a `@provides` directive, you will need to implement the Parent type of the field being
provided as an external ref, and then use the `.provides` method of the returned ref when defining
the field that will have the `@provides` directive. The provided field must be listed as an
`externalField` in the external type.

```typescript
const UserType = builder.externalRef('User', builder.selection<{ id: string }>('id')).implement({
  externalFields: (t) => ({
    // The field that will be provided
    username: t.string(),
  }),
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const ReviewType = builder.objectRef<Review>('Review');
ReviewType.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    body: t.exposeString('body'),
    author: t.field({
      // using UserType.provides<...>(...) instead of just UserType adds the provide annotations
      // and ensures the resolved value includes data for the provided field
      // The generic in Type.provides works the same as the `builder.selection` method.
      type: UserType.provides<{ username: string }>('username'),
      resolve: (review) => ({
        id: review.authorID,
        username: usernames.find((username) => username.id === review.authorID)!.username,
      }),
    }),
    product: t.field({
      type: Product,
      resolve: (review) => ({ upc: review.product.upc }),
    }),
  }),
});
```

### Building your schema and starting a server

```typescript
// Use new `toSubGraphSchema` method to add subGraph specific types and queries to the schema
const schema = builder.toSubGraphSchema({
  // defaults to v2.6
  linkUrl: 'https://specs.apollo.dev/federation/v2.3',
  // defaults to the list of directives used in your schema
  federationDirectives: ['@key', '@external', '@requires', '@provides'],
});

const server = new ApolloServer({
  schema,
});

startStandaloneServer(server, { listen: { port: 4000 } })
  .then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
  })
  .catch((error) => {
    throw error;
  });
```

For a functional example that combines multiple graphs built with Pothos into a single schema see
[https://github.com/hayes/pothos/tree/main/packages/plugin-federation/tests/example](https://github.com/hayes/pothos/tree/main/packages/plugin-federation/tests/example)

### Printing the schema

If you are printing the schema as a string for any reason, and then using the printed schema for
Apollo Federation(submitting if using Managed Federation, or composing manually with `rover`), you
must use `printSubgraphSchema`(from `@apollo/subgraph`) or another compatible way of printing the
schema(that includes directives) in order for it to work.

### Field directives directives

Several federation directives can be configured directly when defining a field includes
`@shareable`, `@tag`, `@inaccessible`, and `@override`.

```ts
t.field({
  type: 'String',
  shareable: true,
  tag: ['someTag'],
  inaccessible: true,
  override: { from: 'users' },
});
```

For more details on these directives, see the official Federation documentation.

### interface entities and @interfaceObject

Federation 2.3 introduces new features for federating interface definitions.

You can now pass interfaces to `asEntity` to defined keys for an interface:

```ts
const Media = builder.interfaceRef<{ id: string }>('Media').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    ...
  }),
});

builder.asEntity(Media, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: ({ id }) => loadMediaById(id),
});
```

You can also extend interfaces from another subGraph by creating an `interfaceObject`:

```ts
const Media = builder.objectRef<{ id: string }>('Media').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    // add new MediaFields here that are available on all implementors of the `Media` type
  }),
});

builder.asEntity(Media, {
  interfaceObject: true,
  key: builder.selection<{ id: string }>('id'),
  resolveReference: (ref) => ref,
});
```

See federation documentation for more details on `interfaceObject`s

### composeDirective

You can apply the `composeDirective` directive when building the subgraph schema:

```ts
export const schema = builder.toSubGraphSchema({
  // This adds the @composeDirective directive
  composeDirectives: ['@custom'],
  // composeDirective requires an @link directive on the schema pointing the the url for your directive
  schemaDirectives: {
    link: { url: 'https://myspecs.dev/myCustomDirective/v1.0', import: ['@custom'] },
  },
  // You currently also need to provide an actual implementation for your Directive
  directives: [
    new GraphQLDirective({
      locations: [DirectiveLocation.OBJECT, DirectiveLocation.INTERFACE],
      name: 'custom',
    }),
  ],
});
```
