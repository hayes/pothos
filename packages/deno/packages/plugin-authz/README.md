# AuthZ plugin

This is a simple plugin for integrating with
[GraphQL AuthZ](https://github.com/apigee/graphql-authz)

For more details on GraphQL AuthZ see the official
[documentation here](https://github.com/apigee/graphql-authz)

## Usage

### Install

```bash
yarn add @giraphql/plugin-authz
```

### Setup

```typescript
import AuthzPlugin from '@giraphql/plugin-authz';

const builder = new SchemaBuilder<{
  AuthZRule: keyof typeof rules;
}>({
  plugins: [AuthzPlugin],
});
```

## Defining rules for fields

```typescript
builder.queryType({
  fields: (t) => ({
    users: t.field({
      type: [User],
      authz: {
        rules: ['IsAuthenticated'],
      },
      resolve: () => users,
    }),
  }),
});
```

## Defining rules for types

```typescript
const Post = builder.objectRef<IPost>('Post');

Post.implement({
  authz: {
    rules: ['CanReadPost'],
  },
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});
```
