# With-Input plugin

Define a field and its input object together with `t.fieldWithInput`. The plugin creates the
input type and a required `input` argument. Use a core `builder.inputType` instead when several
fields should share the same input type.

## Run generated inputs

The example has a default `input` argument, a renamed `criteria` argument, and an optional input.
Run the first operation and inspect the SDL for `QueryEchoInput` and `LookupInput`. Omitted and
explicitly null optional inputs both return `Anonymous`; a populated input returns `Leia`.
The second operation omits a required input and receives a GraphQL validation error.

```typescript
    echo: t.fieldWithInput({
      type: 'ID',
      input: { id: t.input.id({ required: true }) },
      resolve: (_, { input }) => input.id,
    }),

    lookup: t.fieldWithInput({
      type: 'ID',
      typeOptions: { name: 'LookupInput' },
      argOptions: { name: 'criteria' },
      input: { id: t.input.id({ required: true }) },
      resolve: (_, { criteria }) => criteria.id,
    }),

    optional: t.fieldWithInput({
      type: 'String',
      argOptions: { required: false },
      input: { name: t.input.string() },
      resolve: (_, { input }) => input?.name ?? 'Anonymous',
    }),
```

Change the optional resolver fallback from `Anonymous` to `Visitor` and run again. The omitted
and null inputs now return `Visitor`, while the populated input still returns `Leia`.

## Usage

### Install

```package-install
npm install --save @pothos/plugin-with-input
```

### Setup

```typescript
import SchemaBuilder from '@pothos/core';
import WithInputPlugin from '@pothos/plugin-with-input';
const builder = new SchemaBuilder({
  plugins: [WithInputPlugin],
  // optional
  withInput: {
    typeOptions: {
      // default options for Input object types created by this plugin
    },
    argOptions: {
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
  example(input: QueryExampleInput!): ID
}

input QueryExampleInput {
  id: ID!
}
```

The input name will default to `${ParentType.name}${Field.name}Input`.

### Customizing your input object

Replace the previous query definition with this version to customize both names:

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

### Changing the nullability of the input arg

You can configure the global default for input args when creating the builder by providing
`WithInputArgRequired` in the builder's `SchemaTypes`, and setting `withInput.argOptions.required`.

```typescript
const builder = new SchemaBuilder<{ WithInputArgRequired: false }>({
  plugins: [WithInputPlugin],
  withInput: {
    argOptions: {
      required: false,
    },
  },
});
```

Alternatively, keep the original builder and set `argOptions.required` on an individual field.

```typescript
builder.queryType({
  fields: (t) => ({
    example: t.fieldWithInput({
      type: 'Boolean',
      argOptions: {
        required: false,
      },
      input: {
        someInput: t.input.boolean({}),
      },
      resolve: (root, args) => {
        return args.input?.someInput;
      },
    }),
  }),
});
```

### Prisma plugin integration

If you are using the prisma plugin you can use `t.prismaFieldWithInput` to add prisma fields with
input objects. This example assumes a builder configured for the Prisma and With-Input plugins,
a `User` Prisma object, and a Prisma client named `prisma`:

```typescript
builder.queryField('user', (t) =>
  t.prismaFieldWithInput({
    type: 'User',
    input: {
      id: t.input.id({ required: true }),
    },
    resolve: (query, _, args) =>
      prisma.user.findUnique({
        where: {
          id: Number.parseInt(args.input.id, 10),
        },
        ...query,
      }),
  }),
);
```

### Customizing the default naming conventions

If you want to customize how the default input type names are generated you can provide a name
callback in `withInput.typeOptions`:

```typescript
import WithInputPlugin from '@pothos/plugin-with-input';
const builder = new SchemaBuilder({
  plugins: [WithInputPlugin],
  withInput: {
    typeOptions: {
      name: ({ parentTypeName, fieldName }) => {
        const capitalizedFieldName = `${fieldName[0].toUpperCase()}${fieldName.slice(1)}`;
        // This will remove the default Query/Mutation prefix from the input type name
        if (parentTypeName === 'Query' || parentTypeName === 'Mutation') {
          return `${capitalizedFieldName}Input`;
        }

        return `${parentTypeName}${capitalizedFieldName}Input`;
      },
    },
  },
});
```
