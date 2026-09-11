// #region example
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

// #endregion example

// #region extension
builder.objectFields(User, (t) => ({
  initials: t.string({
    resolve: (user) => `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`,
  }),
}));
// #endregion extension
export const schema = builder.toSchema();
