# Simple Objects Plugin for Pothos

The Simple Objects Plugin provides a way to define objects and interfaces without defining type
definitions for those objects, while still getting full type safety.

## Usage

### Install

```bash
yarn add @pothos/plugin-simple-objects
```

### Setup

```typescript
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';
const builder = new SchemaBuilder({
  plugins: [SimpleObjectsPlugin],
});
```

### Example

```typescript
import SchemaBuilder from '@pothos/core';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';

const builder = new SchemaBuilder({
  plugins: [SimpleObjectsPlugin],
});

const ContactInfo = builder.simpleObject('ContactInfo', {
  fields: (t) => ({
    email: t.string({
      nullable: false,
    }),
    phoneNumber: t.string({
      nullable: true,
    }),
  }),
});

const Node = builder.simpleInterface('Node', {
  fields: (t) => ({
    id: t.id({
      nullable: false,
    }),
  }),
});

const UserType = builder.simpleObject(
  'User',
  {
    interfaces: [Node],
    fields: (t) => ({
      firstName: t.string(),
      lastName: t.string(),
      contactInfo: t.field({
        type: ContactInfo,
        nullable: false,
      }),
    }),
  },
  // You can add additional fields with resolvers with a third fields argument
  (t) => ({
    fullName: t.string({
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
  }),
);

builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: UserType,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (parent, args, { User }) => {
        return {
          id: '1003',
          firstName: 'Leia',
          lastName: 'Organa',
          contactInfo: {
            email: 'leia@example.com',
            phoneNumber: null,
          },
        };
      },
    }),
  }),
});
```

## Extending simple objects

In some cases, you may want to add more complex fields with resolvers or args where the value isn't
just passed down from the parent.

In these cases, you can either add the field in the 3rd arg (fields) as shown above, or you can add
additional fields to the type using methods like `builder.objectType`:

```typescript
builder.objectType(UserType, (t) => ({
  fullName: t.string({
    resolve: (user) => `${user.firstName} ${user.lastName}`,
  }),
}));
```

## Limitations

When using simpleObjects in combination with other plugins like authorization, those plugins may use
`unknown` as the parent type in some custom fields \(eg. `parent` of a permission check function on
a field\).
