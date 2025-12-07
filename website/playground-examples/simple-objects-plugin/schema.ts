import SchemaBuilder from '@pothos/core';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';

const builder = new SchemaBuilder({
  plugins: [SimpleObjectsPlugin],
});

// Simple object - types are automatically inferred
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

// Simple interface - no explicit type needed
const Node = builder.simpleInterface('Node', {
  fields: (t) => ({
    id: t.id({
      nullable: false,
    }),
  }),
});

// Simple object with interface and computed fields
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
  // Third argument: fields with custom resolvers
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
      resolve: () => ({
        id: '1',
        firstName: 'Jane',
        lastName: 'Doe',
        contactInfo: {
          email: 'jane@example.com',
          phoneNumber: '+1-555-0123',
        },
      }),
    }),
  }),
});

export const schema = builder.toSchema();
