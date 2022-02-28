import builder from '../builder';

builder.prismaNode('User', {
  id: { resolve: (user) => user.id },
  findUnique: (id) => ({ id: Number.parseInt(id, 10) }),
  select: {
    id: true,
  },
  fields: (t) => ({
    name: t.exposeString('name', { nullable: true }),
    email: t.exposeString('email'),
    bio: t.string({
      select: {
        profile: {
          select: {
            bio: true,
          },
        },
      },
      nullable: true,
      resolve: (user) => user.profile.bio,
    }),
  }),
});
