# With-Input Plugin

A plugin for creating fields with a single input object. This plugin adds a new `t.fieldWithInput`
method that allows you to more easily define fields with a single input type without having to
define it separately.

## Usage

### Install

```bash
yarn add @pothos/plugin-with-input
```

### Setup

```typescript
import WithInputPlugin from '@pothos/plugin-with-input';
const builder = new SchemaBuilder({
  plugins: [WithInputPlugin],
  // optional
  withInput: {
    typeOptions: {
      // default options for Input object types created by this plugin
    },
    argOptions: {
      // default options for the "input" args
      // set required: false to override default behavior
    },
  },
});
```

### Defining fields with inputs

```typescript
builder.queryType({
  fields: (t) => ({
    example: t.fieldWithInput({
      input: {
        // Note that this uses a new t.input field builder for defining input fields
        id: t.input.id({ required: true }),
      },
      type: 'ID',
      resolve: (root, args) => args.input.id,
    }),
  }),
});
```

This will produce a schema like:

```graphql
type Query {
  example(input: QueryExampleInput!): ID!
}

input QueryExampleInput {
  id: ID!
}
```

The input name will default to `${ParentType.name}${Field.name}Input`.

### Customizing your input object

You can customize the name of your Input object, and the name of the input argument:

```typescript
builder.queryType({
  fields: (t) => ({
    example: t.fieldWithInput({
      typeOptions: {
        name: 'CustomInputTypeName',
        // Additional options for the input type can be added here
      },
      argOptions: {
        name: 'customArgName',
        // Additional options for the input argument can be added here
      },
      input: {
        id: t.input.id({ required: true }),
      },
      type: 'ID',
      // inputs are now under `customArgName`
      resolve: (root, args) => args.customArgName.id,
    }),
  }),
});
```
