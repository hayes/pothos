---
name: SubGraph
menu: Plugins
---

# SubGraph Plugin

A plugin for creating sub-selections of your graph. This Allows you to use the same code/types for multiple variants of your API.

One common use case for this is to share implementations between your public and internal APIs, by only exposing a subset of your graph publicly.

## Usage

### Install

```bash
yarn add @giraphql/plugin-sub-graph
```

### Setup

```typescript
import SubGraphPlugin from '@giraphql/plugin-sub-graph';
const builder = new SchemaBuilder<{
  SubGraphs: 'Public' | 'Internal';
}>({
  plugins: [SubGraphPlugin],
  subGraphs: {
    defaultsForTypes: [],
    inheritFieldGraphsFromType: true,
  },
});

//in another file:

const schema = builder.toSchema({});
const publicSchema = builder.toSchema({ subGraph: 'Public' });
const internalSchema = builder.toSchema({ subGraph: 'Internal' });
```

### Options on Types

* `subGraphs`: An optional array of sub-graph the type should be included in.

### Object and Interface types:

* `defaultSubGraphsForFields`: Default sub-graph for fields of the type to be included in.

## Options on Fields

* `subGraphs`: An optional array of sub-graph the field to be included in. If not provided, will

  fallback to:

  * `defaultSubGraphsForFields` if set on type
  * `subGraphs` of the type if `subGraphs.fieldsInheritFromTypes` was set in the builder
  * an empty array

### Options on Builder

* `subGraphs.defaultForTypes`: Specifies what sub-graph a type is part of by default.
* `subGraphs.fieldsInheritFromTypes`: defaults to `false`. When true, fields on a type will default

  to being part of the same sub-graph as their parent type. Only applies when type does not have

  `defaultSubGraphsForFields` set.

You can mock any field by adding a mock in the options passed to `builder.buildSchema` under `mocks.{typeName}.{fieldName}`.

### Usage

```typescript
builder.queryType({
  subGraphs: ['Public', 'Internal'], // Query type will be available in default, Public, and Internal schemas
  defaultSubGraphsForFields: []; // Fields on the Query object will now default to not being a part of any subgraph
  fields: (t) => ({
    someField: t.string({
      subGraphs: ['Internal'] // someField will be in the default schema and "Internal" sub graph, but not present in the Public sub graph
      resolve: () => {
        throw new Error('Not implemented');
      },
    }),
  }),

});
```

### Missing types

When creating a subgraph, the plugin will only copy in types that are included in the sub-graph, either by explicitly setting it on the type, or because the sub-graph is included in the default list. Like types, output fields that are not included in a sub-graph will also be omitted. Arguments and fields on Input types can not be removed because that would break assumptions about arguments types in resolves.

If a type that is not included in the sub-graph is referenced by another part of the graph that is included in the graph, a runtime error will be thrown when the sub graph is constructed. This can happen in a number of cases including cases where a removed type is used in the interfaces of an object, a member of a union, or the type of an field argument.

