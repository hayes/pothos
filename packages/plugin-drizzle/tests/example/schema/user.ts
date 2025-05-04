import { drizzleConnectionHelpers } from '../../../src';
import { builder } from '../builder';
import { db } from '../db';

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

export const NormalViewer = builder.drizzleObject('users', {
  variant: 'NormalViewer',
  interfaces: () => [Viewer],
  select: {
    columns: {},
  },
  fields: (t) => ({
    isNormal: t.boolean({
      resolve: () => true,
    }),
  }),
});

export const Viewer = builder.drizzleInterface('users', {
  name: 'Viewer',
  select: {
    columns: {},
  },
  resolveType: () => 'NormalViewer',
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

export const Admin = builder.drizzleNode('users', {
  variant: 'Admin',
  id: {
    column: (user) => user.id,
  },
  select: {},
  fields: (t) => ({
    isAdmin: t.boolean({
      resolve: () => true,
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
    extras: {
      lowercaseFirstName: (users, sql) => {
        return sql.sql<string>`lower(${users.firstName})`;
      },
    },
  },
  fields: (t) => ({
    email: t.string({
      select: {
        extras: {
          lowercaseLastName: (users, sql) => sql.sql<string>`lower(${users.lastName})`,
        },
      },
      resolve: (user) => `${user.lowercaseFirstName}.${user.lowercaseLastName}@example.com`,
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

builder.queryField('userRolesConnection', (t) =>
  t.connection({
    type: Role,
    args: {
      userId: t.arg.int({ required: true }),
    },
    nodeNullable: true,
    resolve: async (_, args, ctx, info) => {
      const query = rolesConnection.getQuery(args, ctx, info);
      const userRoles = await db.query.userRoles.findMany({
        ...query,
        where: {
          ...query.where,
          userId: args.userId,
        },
      });
      return rolesConnection.resolve(userRoles, args, ctx);
    },
  }),
);

builder.queryField('admin', (t) =>
  t.drizzleField({
    type: Admin,
    resolve: (query, _root, _args, ctx) => {
      return ctx.roles.includes('admin')
        ? db.query.users.findFirst(
            query({
              where: {
                id: ctx.user?.id,
              },
            }),
          )
        : null;
    },
  }),
);

builder.drizzleInterfaceField(Viewer, 'selfList', (t) =>
  t.relation('manySelf', {
    type: Viewer,
  }),
);
