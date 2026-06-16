import { builder } from '../builder.ts';
import { db } from '../db.ts';

export const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    name: t.exposeString('name'),
    isAdmin: t.boolean({
      select: { with: { userRoles: true } },
      resolve: (user) => user.userRoles.some((r) => r.role === 'admin'),
    }),
    teams: t.relation('teams', {
      description: 'Teams this user belongs to (as captain or player).',
    }),
    teamRoles: t.relation('teamRoles', {
      description: 'All team memberships for this user.',
    }),
    captainRoles: t.relation('teamRoles', {
      description: 'Memberships filtered to captain roles. Use `.team` to traverse.',
      query: { where: { role: 'captain' } },
    }),
  }),
});

builder.queryFields((t) => ({
  me: t.drizzleField({
    type: 'users',
    nullable: true,
    description: 'The user identified by the x-user-id header, if any.',
    resolve: (query, _root, _args, ctx) => {
      if (!ctx.user) {
        return null;
      }
      return db.query.users.findFirst(query({ where: { id: ctx.user.id } }));
    },
  }),
  user: t.withAuth({ admin: true }).drizzleField({
    type: 'users',
    nullable: true,
    description: 'Look up an arbitrary user. Admin-only.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      db.query.users.findFirst(query({ where: { id: Number.parseInt(args.id, 10) } })),
  }),
}));
