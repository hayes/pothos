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

const UserType = builder.simpleObject('User', {
  interfaces: [Node],
  fields: (t) => ({
    firstName: t.string(),
    lastName: t.string(),
    contactInfo: t.field({
      type: ContactInfo,
      nullable: false,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: UserType,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (parent, args, { User }) => {
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

export default builder.toSchema({});
