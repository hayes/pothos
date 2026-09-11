# SubGraph plugin

Use one set of type definitions to build several API variants. Tag types and fields with named
sub-graphs, then pass `subGraph` to `builder.toSchema()` to select a variant. This is separate from
Apollo Federation: a sub-graph here is a filtered view of your own schema.

## Install

```package-install
npm install --save @pothos/plugin-sub-graph
```

## Build public and internal schemas

Declare the sub-graph names in `SubGraphs`. In this example, types and fields belong to both variants
by default, while `internalNotes` is available only in the internal API:

```typescript
import SchemaBuilder from '@pothos/core';
import SubGraphPlugin from '@pothos/plugin-sub-graph';

const builder = new SchemaBuilder<{
  SubGraphs: 'Public' | 'Internal';
}>({
  plugins: [SubGraphPlugin],
  subGraphs: {
    defaultForTypes: ['Public', 'Internal'],
    fieldsInheritFromTypes: true,
  },
});

const Product = builder
  .objectRef<{
    id: string;
    name: string;
    internalNotes: string;
  }>('Product')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      internalNotes: t.exposeString('internalNotes', {
        subGraphs: ['Internal'],
      }),
    }),
  });

builder.queryType({
  fields: (t) => ({
    product: t.field({
      type: Product,
      resolve: () => ({ id: '1', name: 'Notebook', internalNotes: 'Restock next week' }),
    }),
  }),
});
```

Choose a build target, then run the field inspection and internal-notes operations:

**Public**

```typescript
export const schema = builder.toSchema({ subGraph: 'Public' });
```

**Internal**

```typescript
export const schema = builder.toSchema({ subGraph: 'Internal' });
```

**Combined**

```typescript
export const schema = builder.toSchema({ subGraph: ['Internal', 'Public'] });
```

**Shared**

```typescript
export const schema = builder.toSchema({ subGraph: { all: ['Internal', 'Public'] } });
```

`{ product { name } }` works in either variant. `{ product { internalNotes } }` fails GraphQL
validation against the Public variant. Calling `toSchema()` without a sub-graph retains the full schema.

## Combine variants

An array includes types and fields belonging to any listed sub-graph:

```typescript
const combinedSchema = builder.toSchema({ subGraph: ['Internal', 'Public'] });
```

The `all` form includes only membership shared by every listed sub-graph:

```typescript
const sharedSchema = builder.toSchema({ subGraph: { all: ['Internal', 'Public'] } });
```

For the example above, the combined schema includes `internalNotes`; the shared schema omits it.

## Membership options

Set `subGraphs` on a type or field to override its defaults. A type without this option uses
`subGraphs.defaultForTypes` from the builder.

A field's membership is determined in this order:

1. Its own `subGraphs` option.
2. Its parent type's `defaultSubGraphsForFields` option.
3. Its parent type's membership, when `subGraphs.fieldsInheritFromTypes` is `true`.
4. The builder's `subGraphs.defaultForFields` option.
5. An empty array.

`fieldsInheritFromTypes` defaults to `false`. An explicit empty array overrides the fallback, so
`defaultSubGraphsForFields: []` on a type makes its fields opt in individually.

## Inputs and missing types

Nullable arguments and input fields can also have `subGraphs`. Required arguments and input fields
cannot be removed from a retained field or input object: resolvers may depend on them being present.
The plugin rejects a schema that tries to remove one.

An output field is omitted when its return type is excluded. Other references can make a filtered
schema invalid, such as a retained union containing an excluded member or a required argument using
an excluded input type. Include those dependencies in the variant or exclude the referring field or
type as well. Build and validate each variant you intend to serve.

## Include unreachable types

Types that remain unreachable after filtering are normally omitted. The
`subGraphs.explicitlyIncludeType` callback retains matching types that already belong to the selected
sub-graph, even when no field reaches them.

For federation entities, `hasResolvableKey` can retain an otherwise unreachable external reference.
Use this as a separate builder setup with both plugins:

```typescript
import SchemaBuilder from '@pothos/core';
import FederationPlugin, { hasResolvableKey } from '@pothos/plugin-federation';
import SubGraphPlugin from '@pothos/plugin-sub-graph';

const builder = new SchemaBuilder<{
  SubGraphs: 'Public' | 'Internal';
}>({
  plugins: [SubGraphPlugin, FederationPlugin],
  subGraphs: {
    defaultForTypes: ['Public', 'Internal'],
    fieldsInheritFromTypes: true,
    explicitlyIncludeType: (type) => hasResolvableKey(type),
  },
});
```
