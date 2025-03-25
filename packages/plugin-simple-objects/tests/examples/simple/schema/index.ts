import builder from '../builder';

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

const Timestamps = builder.simpleInterface('Timestamps', {
  fields: (t) => ({
    createdAt: t.string(),
    updatedAt: t.string(),
  }),
});

const Person = builder.simpleInterface('Person', {
  interfaces: [Node, Timestamps],
  fields: (t) => ({
    firstName: t.string(),
    lastName: t.string(),
  }),
});

const UserType = builder.simpleObject(
  'User',
  {
    interfaces: [Node, Person, Timestamps],
    fields: (t) => ({
      contactInfo: t.field({
        type: ContactInfo,
        nullable: false,
      }),
    }),
  },
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
      resolve: (_parent, args, { User }) => {
        const user = User.map.get(Number.parseInt(args.id, 10));

        if (!user) {
          throw new Error(`User with id ${args.id} was not found`);
        }

        return {
          ...user,
          contactInfo: {
            email: user.email,
          },
        };
      },
    }),
  }),
});

export default builder.toSchema();
