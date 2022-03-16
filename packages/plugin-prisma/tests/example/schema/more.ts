import builder from '../builder';

function selectBio(args: {}) {
  return {
    profile: {
      select: {
        bio: true,
      },
    },
  };
}

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
      select: selectBio,
      nullable: true,
      resolve: (user) => user.profile.bio,
    }),
  }),
});
