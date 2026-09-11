# Add GraphQL plugin

Import types from an existing executable GraphQL schema while migrating fields to Pothos. Use the
builder's `add` option to import a schema or a group of types. Use `addGraphQLObject` and the other
builder methods to obtain refs for individual types and customize their fields.

## Install

```package-install
npm install --save @pothos/plugin-add-graphql
```

## Import a schema

This example starts with a small executable schema defined with GraphQL.js. In an application,
`existingSchema` can instead be an imported schema from another schema-building library.

```typescript
import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';

type User = { name: string };

const ExistingUser = new GraphQLObjectType<User>({
  name: 'User',
  fields: { name: { type: GraphQLString } },
});

const existingSchema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      user: {
        type: ExistingUser,
        resolve: () => ({ name: 'Leia' }),
      },
    },
  }),
});

const builder = new SchemaBuilder<{ Objects: { User: User } }>({
  plugins: [AddGraphQLPlugin],
  add: { schema: existingSchema },
});

builder.queryFields((t) => ({
  otherUser: t.field({
    type: 'User',
    resolve: () => ({ name: 'Luke' }),
  }),
}));

export const schema = builder.toSchema();
```

[Run this example](https://pothos-graphql.dev/playground?example=plugin-add-graphql)

Both `{ user { name } }` and `{ otherUser { name } }` work on the resulting schema. The imported
`user` field keeps its resolver, and the new field returns the same backing shape.

Types are imported only if Pothos has no registered type with that name when the schema is built.
A Pothos definition takes precedence over an imported definition. When importing a schema with a
query root, use `queryFields` to add fields; defining a replacement `queryType` causes the imported
root definition to be skipped. The same rule applies to mutation and subscription roots.

## Import selected types

Use `add.types` instead of `add.schema` to import individual named types:

```typescript
const builder = new SchemaBuilder<{ Objects: { User: User } }>({
  plugins: [AddGraphQLPlugin],
  add: { types: [ExistingUser] },
});

builder.queryType({
  fields: (t) => ({
    user: t.field({ type: 'User', resolve: () => ({ name: 'Leia' }) }),
  }),
});
```

[Run this example](https://pothos-graphql.dev/playground?example=plugin-add-graphql-types)

This is an alternative to the schema-import builder above. Dependencies reached through fields,
arguments, interfaces, and union members are imported recursively.

Declare imported object, interface, and scalar backing shapes in the builder's `Objects`,
`Interfaces`, or `Scalars` schema types to reference them by name. For other kinds, use a ref from
one of the methods below.

## Import a type as a ref

The individual methods return refs that work in ordinary Pothos field definitions. This alternative
builder imports `ExistingUser`, renames it, and replaces its `name` field with `displayName`:

```typescript
const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin] });

const ImportedUser = builder.addGraphQLObject<User>(ExistingUser, {
  name: 'ImportedUser',
  fields: (t) => ({
    name: null,
    displayName: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.field({ type: ImportedUser, resolve: () => ({ name: 'Leia' }) }),
  }),
});
```

[Run this example](https://pothos-graphql.dev/playground?example=plugin-add-graphql-ref)

Query this version with `{ user { displayName } }`. A `null` entry removes an imported field;
a field ref adds or replaces one. Fields not mentioned in the callback retain their imported definitions.

| Method | Source type | Returned ref |
| --- | --- | --- |
| `addGraphQLObject<Shape>` | `GraphQLObjectType` | Object |
| `addGraphQLInterface<Shape>` | `GraphQLInterfaceType` | Interface |
| `addGraphQLUnion<Shape>` | `GraphQLUnionType` | Union |
| `addGraphQLEnum<Shape>` | `GraphQLEnumType` | Enum |
| `addGraphQLInput<Shape>` | `GraphQLInputObjectType` | Input object |

Pass the backing shape as the generic parameter. Keep the source type in a typed variable, as
`ExistingUser` is above; when looking up a type by name with `schema.getType`, check that it exists
and is the expected GraphQL kind before passing it to a method.

Object, interface, and input methods support field overrides. Unions accept a `types` override,
and enums accept `values`. Object and interface descriptions and type-resolution functions are
copied from the source, so configure those on the source type. The `name` option renames the import,
and `extensions` are merged with the imported extensions.

### Interface, union, enum, and input refs

This separate example imports an interface and union backed by member records, an enum whose
values are strings, and an input with an optional name. The refs can be used in output fields and
arguments like types defined directly with Pothos:

```typescript
import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLString,
  GraphQLUnionType,
} from 'graphql';

type MemberShape = { name: string };
type FilterShape = { name?: string | null };

const ExistingNamed = new GraphQLInterfaceType({
  name: 'Named',
  fields: { name: { type: GraphQLString } },
  resolveType: () => 'Member',
});
const ExistingMember = new GraphQLObjectType<MemberShape>({
  name: 'Member',
  interfaces: [ExistingNamed],
  fields: { name: { type: GraphQLString } },
});
const ExistingSearchResult = new GraphQLUnionType({
  name: 'SearchResult',
  types: [ExistingMember],
  resolveType: () => 'Member',
});
const ExistingOrder = new GraphQLEnumType({
  name: 'Order',
  values: { ASC: { value: 'asc' }, DESC: { value: 'desc' } },
});
const ExistingFilter = new GraphQLInputObjectType({
  name: 'MemberFilter',
  fields: { name: { type: GraphQLString } },
});

const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin] });
const Named = builder.addGraphQLInterface<MemberShape>(ExistingNamed);
const SearchResult = builder.addGraphQLUnion<MemberShape>(ExistingSearchResult);
const Order = builder.addGraphQLEnum<'asc' | 'desc'>(ExistingOrder);
const MemberFilter = builder.addGraphQLInput<FilterShape>(ExistingFilter);

const members: MemberShape[] = [{ name: 'Leia' }, { name: 'Luke' }];
builder.queryType({
  fields: (t) => ({
    member: t.field({ type: Named, resolve: () => members[0] }),
    search: t.field({
      type: [SearchResult],
      args: {
        filter: t.arg({ type: MemberFilter }),
        order: t.arg({ type: Order }),
      },
      resolve: (_parent, { filter, order }) => {
        const matches = members.filter((member) => !filter?.name || member.name === filter.name);
        return order === 'desc' ? matches.reverse() : matches;
      },
    }),
  }),
});
```

[Run this example](https://pothos-graphql.dev/playground?example=plugin-add-graphql-kinds)

The source interface and union keep their `resolveType` functions. The enum exposes `ASC` and
`DESC` to GraphQL clients while resolvers receive `'asc'` and `'desc'`:

```graphql
query {
  member { name }
  search(filter: { name: "Leia" }, order: ASC) {
    ... on Member { name }
  }
}
```

### Referencing imported interfaces and scalars by name

To use names instead of refs, declare the backing shapes in `Interfaces` and `Scalars`. This
alternative builder uses `ExistingNamed` above and a `DateTime` GraphQL scalar imported from your
application. Its parser must produce JavaScript `Date` values, and its serializer must accept them:

```typescript
import { DateTime } from './scalars';

const builder = new SchemaBuilder<{
  Interfaces: { Named: MemberShape };
  Scalars: { DateTime: { Input: Date; Output: Date } };
}>({
  plugins: [AddGraphQLPlugin],
  add: { types: [ExistingNamed, ExistingMember, DateTime] },
});

builder.queryType({
  fields: (t) => ({
    member: t.field({ type: 'Named', resolve: () => ({ name: 'Leia' }) }),
    now: t.field({ type: 'DateTime', resolve: () => new Date() }),
  }),
});
```

Include concrete implementations such as `ExistingMember` when importing an interface alone;
its field definitions do not identify all the types that implement it.

## Scalars

Use core Pothos's `builder.addScalarType` for an existing `GraphQLScalarType`; this plugin does not
add a scalar-specific method. Declare that scalar's input and output shapes in the builder's
`Scalars` schema type, as described in [Scalars](https://pothos-graphql.dev/docs/guide/scalars).
