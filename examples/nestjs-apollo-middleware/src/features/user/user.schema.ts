import { schemaBuilder } from 'src/graphql/schema.builder';
import { User } from './user.model';
import { UserRepository } from './user.repository';

export const UserSchema = schemaBuilder.objectRef<User>('User');

UserSchema.implement({
  fields: (t) => ({
    id: t.exposeID('id', { nullable: false }),
    firstName: t.exposeString('firstName', { nullable: false }),
    lastName: t.exposeString('lastName', { nullable: false }),
    fullName: t.string({
      nullable: false,
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
  }),
});

schemaBuilder.queryType({
  fields: (t) => ({
    user: t.field({
      type: UserSchema,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_root, args, ctx) => ctx.get(UserRepository).getUserById(args.id),
    }),
  }),
});
