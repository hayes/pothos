---
name: SubGraph
menu: Plugins
---

# SubGraph Plugin

A plugin for creating sub-selections of your graph. This Allows you to use the same code/types for
multiple variants of your API.

One common use case for this is to share implementations between your public and internal APIs, by
only exposing a subset of your graph publicly.

## Usage

### Install

```bash
yarn add @giraphql/plugin-sub-graph
```

### Setup

```typescript
import '@giraphql/plugin-sub-graph';
const builder = new SchemaBuilder<{
  SubGraphs: 'Public' | 'Other';
}>({
  plugins: ['GiraphQLSubGraph'],
  subGraph: {
    defaultGraphsForType: [],
    : true,
  },
});

//in another file:

const schema = builder.toSchema({});
const publicSchema = builder.toSubGraphSchema({}, 'Public');
const otherSchema = builder.toSubGraphSchema({}, 'Other');
```

### Options

- `defaultGraphsForType`: Specifies what subGraphs a type is part of by default.
- `inheritFieldGraphsFromType`: defaults to `false`. When true, fields on a type will default to
  being part of the same subGraphs as their parent type.
- `defaultGraphsForField`: Specifies what subGraphs a field is part of by default, only used if
  `inheritFieldGraphsFromType` is false

You can mock any field by adding a mock in the options passed to `builder.builSchema` under
`mocks.{typeName}.{fieldName}`.

### Usage

```typescript
builder.queryType({
  subGraphs: ['Public', 'Other'], // Query type will be available in default, Public, and Other schemas
  fields: (t) => ({
    someField: t.string({
      subGraphs: ['Other'] // someField will be in the default schema and Other schema, but not present in the Public schema
      resolve: () => {
        throw new Error('Not implemented');
      },
    }),
  }),

});
```

### Missing types

When creating a subgraph, the plugin will only copy in types that are included in the subGraph,
either by explicitly setting it on the type, or because the sub-graph is included in the default
list. Like types, output fields that are not included in a sub-graph will also be omitted. Arguments
and fields on Input types can not be removed because that would break assumptions about arguments
types in resolvers.

If a type that is not included in the subgraph is referenced by another part of the graph that is
included in the graph, a runtime error will be thrown when the sub graph is constructed. This can
happen in a number of cases including cases where a removed case is used in the interfaces of an
object, a member of a union, or the type of an field argument.
