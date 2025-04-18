# SubGraph Plugin for Pothos

A plugin for creating sub-selections of your graph. This allows you to use the same code/types for
multiple variants of your API.

One common use case for this is to share implementations between your public and internal APIs, by
only exposing a subset of your graph publicly.

## Usage

### Install

```bash
yarn add @pothos/plugin-sub-graph
```

### Setup

```typescript
import SubGraphPlugin from '@pothos/plugin-sub-graph';
const builder = new SchemaBuilder<{
  SubGraphs: 'Public' | 'Internal';
}>({
  plugins: [SubGraphPlugin],
  subGraphs: {
    defaultForTypes: [],
    fieldsInheritFromTypes: true,
  },
});

//in another file:

const schema = builder.toSchema();
const publicSchema = builder.toSchema({ subGraph: 'Public' });
const internalSchema = builder.toSchema({ subGraph: 'Internal' });

// You can also build a graph using multiple subgraphs:
const combinedSchema = builder.toSchema({ subGraph: ['Internal', 'Public'] });
```

### Options on Types

- `subGraphs`: An optional array of sub-graph the type should be included in.

### Object and Interface types:

- `defaultSubGraphsForFields`: Default sub-graph for fields of the type to be included in.

## Options on Fields

- `subGraphs`: An optional array of sub-graph the field to be included in. If not provided, will

  fallback to:

  - `defaultSubGraphsForFields` if set on type
  - `subGraphs` of the type if `subGraphs.fieldsInheritFromTypes` was set in the builder
  - an empty array

### Options on Builder

- `subGraphs.defaultForTypes`: Specifies what sub-graph a type is part of by default.
- `subGraphs.fieldsInheritFromTypes`: defaults to `false`. When true, fields on a type will default
  to being part of the same sub-graph as their parent type. Only applies when type does not have
  `defaultSubGraphsForFields` set.

### Usage

```typescript
builder.queryType({
  // Query type will be available in default, Public, and Internal schemas
  subGraphs: ['Public', 'Internal'],
  // Fields on the Query object will now default to not being a part of any subgraph
  defaultSubGraphsForFields: [];
  fields: (t) => ({
    someField: t.string({
      // someField will be in the default schema and "Internal" sub graph, but
      // not present in the Public sub graph
      subGraphs: ['Internal']
      resolve: () => {
        throw new Error('Not implemented');
      },
    }),
  }),
});
```

### Missing types

When creating a sub-graph, the plugin will only copy in types that are included in the sub-graph,
either by explicitly setting it on the type, or because the sub-graph is included in the default
list. Like types, output fields that are not included in a sub-graph will also be omitted. Arguments
and fields on Input types can not be removed because that would break assumptions about argument
types in resolvers.

If a type that is not included in the sub-graph is referenced by another part of the graph that is
included in the graph, a runtime error will be thrown when the sub graph is constructed. This can
happen in a number of cases including cases where a removed type is used in the interfaces of an
object, a member of a union, or the type of a field argument.

### Explicitly including types

You can use the `explicitlyIncludeType` option to explicitly include types in a sub-graph that are
unreachable.  This isn't normally required, but there are some edge cases where this may be useful.

For instance, when extending external references with the federation plugin, the externalRef may
not be reachable directly through your schema, but you may still want to include it when building the
schema.  To work around this, we can explicitly include any any types that have a `key` directive:


```typescript
import FederationPlugin, { hasResolvableKey } from '@pothos/plugin-federation';
import SubGraphPlugin from '@pothos/plugin-sub-graph';

const builder = new SchemaBuilder<{
  SubGraphs: 'Public' | 'Internal';
}>({
  plugins: [SubGraphPlugin, FederationPlugin],
  subGraphs: {
    explicitlyIncludeType: (type, subGraphs) => hasResolvableKey(type)
  },
});
```
