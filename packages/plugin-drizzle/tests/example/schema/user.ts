import { sql } from 'drizzle-orm';
import { drizzleConnectionHelpers } from '../../../src';
import { builder } from '../builder';
import { comments, roles, users } from '../db/schema';

const rolesConnection = drizzleConnectionHelpers(builder, 'userRoles', {
  args: (t) => ({
    invert: t.boolean({
      defaultValue: false,
    }),
  }),
  query: (args: { invert?: boolean | null }) => ({
    orderBy: args.invert ? { roleId: 'desc' } : { roleId: 'asc' },
  }),
  select: (nestedSelection) => ({
    with: {
      role: nestedSelection(),
    },
  }),
  resolveNode: (userRole) => userRole.role,
});

const Role = builder.drizzleObject('roles', {
  name: 'Role',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

export const Viewer = builder.drizzleObject('users', {
  variant: 'Viewer',
  select: {
    columns: {},
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.string({
      select: {
        columns: {
          username: true,
        },
      },
      resolve: (user) => `@${user.username}`,
    }),
    user: t.variant('users'),
    comments: t.relatedConnection('comments', {
      query: {
        orderBy: {
          id: 'desc',
        },
      },
    }),
    drafts: t.relation('posts', {
      query: {
        where: {
          published: 0,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
    }),
    roles: t.stringList({
      select: {
        with: {
          roles: true,
        },
      },
      resolve: (user) => user.roles.map((role) => role.name),
    }),
    rolesConnection: t.connection({
      type: Role,
      args: rolesConnection.getArgs(),
      nodeNullable: true,
      select: (args, ctx, nestedSelection) => ({
        with: {
          userRoles: rolesConnection.getQuery(args, ctx, nestedSelection),
        },
      }),
      resolve: (user, args, ctx) => {
        return rolesConnection.resolve(user.userRoles, args, ctx, user);
      },
    }),
  }),
});

export const User = builder.drizzleNode('users', {
  name: 'User',
  id: {
    column: (user) => user.id,
  },
  select: {
    columns: {
      firstName: true,
      lastName: true,
    },
    with: {
      profile: true,
    },
  },
  fields: (t) => ({
    email: t.string({
      select: {
        extras: {
          lowercase: sql<string>`lower(${users.firstName})`.as('lowercase'),
        },
      },
      resolve: (user) => `${user.lowercase}@example.com`,
    }),
    bio: t.string({
      resolve: (user) => user.profile?.bio,
    }),
    // column values can be exposed even if they are not in the default selection (will be selected automatically)
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    isAdmin: t.boolean({
      select: {
        columns: {},
        with: {
          roles: true,
        },
      },
      nullable: false,
      resolve: (user) => user.roles?.some((role) => role.name === 'admin') ?? false,
    }),
    fullName: t.string({
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    posts: t.relation('posts', {
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
      },
      query: (args) => ({
        limit: args.limit ?? 10,
        offset: args.offset ?? 0,
        where: {
          published: 1,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    }),
    postsConnection: t.relatedConnection('posts', {
      args: {
        category: t.arg.string(),
        invert: t.arg.boolean(),
        sortByCategory: t.arg.boolean(),
      },
      query: (args) => ({
        where: {
          published: 1,
          ...(args.category
            ? {
                category: {
                  name: args.category,
                },
              }
            : {}),
        },
        orderBy: () => {
          if (args.sortByCategory) {
            return {
              categoryId: 'asc',
              id: 'asc',
            };
          }
          return args.invert ? { id: 'asc' } : { id: 'desc' };
        },
      }),
    }),
    unOrderedPostsConnection: t.relatedConnection('posts', {
      query: () => ({
        where: {
          published: 1,
        },
      }),
    }),
    viewer: t.variant(Viewer, {
      select: {
        columns: {
          id: true,
        },
      },
      isNull: (user, _args, ctx) => user.id !== ctx.user?.id,
    }),
  }),
});
