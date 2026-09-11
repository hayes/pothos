# Simple objects plugin

Infer an object's backing shape from its GraphQL fields. Use `simpleObject` or `simpleInterface`
when the resolver returns data in the same shape as the schema. For an existing application model,
use a core `objectRef` or `interfaceRef` with that model's type.

## Usage

### Install

```package-install
npm install --save @pothos/plugin-simple-objects
```

### Example

Run the query to inspect inherited `id`, nested contact data, and computed fields. Change
`firstName` from `Leia` to `Han` in the resolver and run again: `fullName` becomes `Han Organa`
and `initials` becomes `HO`.

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

const User = builder.simpleObject(
  'User',
  {
    interfaces: [Node],
    fields: (t) => ({
      firstName: t.string({ nullable: false }),
      lastName: t.string({ nullable: false }),
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
      type: User,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_parent, { id }) => {
        return {
          id: String(id),
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
additional fields with `builder.objectFields`. This adds a different computed field to `User`:

```typescript
builder.objectFields(User, (t) => ({
  initials: t.string({
    resolve: (user) => `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`,
  }),
}));
```

## Limitations

When using simpleObjects in combination with other plugins like authorization, those plugins may use
`unknown` as the parent type in some custom fields \(eg. `parent` of a permission check function on
a field\).
