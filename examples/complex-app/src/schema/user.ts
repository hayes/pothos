import { builder } from '../builder';
import { db } from '../db';

const User = builder.prismaInterface('User', {
  include: {
    roles: {
      select: {
        role: true,
      },
    },
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
  resolveType: (user) => {
    if (user.roles.some(({ role }) => role === 'ADMIN')) {
      return 'Admin';
    }

    return 'Member';
  },
});

export const Member = builder.prismaObject('User', {
  include: {
    roles: {
      select: {
        role: true,
      },
    },
  },
  variant: 'Member',
  interfaces: [User],
});

export const Admin = builder.prismaObject('User', {
  include: {
    roles: {
      select: {
        role: true,
      },
    },
  },
  variant: 'Admin',
  interfaces: [User],
});

builder.queryField('viewer', (t) =>
  t.prismaField({
    type: User,
    nullable: true,
    resolve: (query, _root, _args, ctx) => {
      if (!ctx.user) {
        return null;
      }

      return db.user.findUnique(
        query({
          where: {
            id: ctx.user.id,
          },
        }),
      );
    },
  }),
);
