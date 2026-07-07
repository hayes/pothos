import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { teamRoles, teams } from '../../db/schema.ts';
import { builder } from '../builder.ts';
import { db } from '../db.ts';

export const TeamRole = builder.drizzleObject('teamRoles', {
  name: 'TeamRole',
  fields: (t) => ({
    id: t.exposeID('id'),
    role: t.exposeString('role'),
    user: t.relation('user'),
    team: t.relation('team'),
  }),
});

export const Team = builder.drizzleObject('teams', {
  name: 'Team',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    createdAt: t.exposeString('createdAt'),
    roster: t.relation('roster', { description: 'Players on the team.' }),
    rosterCount: t.relatedCount('roster'),
    members: t.relation('members', {
      description: 'User accounts associated with this team (captains and players).',
    }),
    teamRoles: t.relation('teamRoles', {
      description: 'All membership edges (role + user) for this team.',
    }),
    captainRoles: t.relation('teamRoles', {
      description: 'Membership edges filtered to captains. Use `.user` to traverse to the User.',
      query: { where: { role: 'captain' } },
    }),
    homeGames: t.relation('homeGames'),
    awayGames: t.relation('awayGames'),
  }),
});

builder.queryFields((t) => ({
  teams: t.drizzleField({
    type: ['teams'],
    resolve: (query) => db.query.teams.findMany(query({ orderBy: { id: 'asc' } })),
  }),
  team: t.drizzleField({
    type: 'teams',
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, args) =>
      db.query.teams.findFirst(query({ where: { id: Number.parseInt(args.id, 10) } })),
  }),
}));

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  createTeam: t.withAuth({ loggedIn: true }).field({
    type: Team,
    description: 'Create a new team. The caller is automatically made captain.',
    args: {
      name: t.arg.string({
        required: true,
        validate: z.string().trim().min(1).max(80),
      }),
    },
    resolve: async (_root, args, ctx) => {
      const name = args.name.trim();

      const existing = await db.query.teams.findFirst({
        columns: { id: true },
        where: { name },
      });
      if (existing) {
        throw new Error(`A team named "${name}" already exists.`);
      }

      const [team] = await db.insert(teams).values({ name }).returning();
      await db.insert(teamRoles).values({
        userId: ctx.user.id,
        teamId: team.id,
        role: 'captain',
      });
      return team;
    },
  }),

  assignTeamRole: t.field({
    type: Team,
    description: "Grant or change a user's role on a team. Captains and admins only.",
    authScopes: (_root, args) => ({
      $any: { admin: true, teamCaptain: Number.parseInt(args.teamId, 10) },
    }),
    args: {
      teamId: t.arg.id({ required: true }),
      userId: t.arg.id({ required: true }),
      role: t.arg.string({
        required: true,
        validate: z.enum(['captain', 'player']),
      }),
    },
    resolve: async (_root, args) => {
      const teamId = Number.parseInt(args.teamId, 10);
      const userId = Number.parseInt(args.userId, 10);
      const role = args.role as 'captain' | 'player';

      // Upsert by deleting any existing membership for the (user, team) pair.
      await db
        .delete(teamRoles)
        .where(and(eq(teamRoles.userId, userId), eq(teamRoles.teamId, teamId)));
      await db.insert(teamRoles).values({ userId, teamId, role });

      const team = await db.query.teams.findFirst({ where: { id: teamId } });
      if (!team) {
        throw new Error(`No team with id ${teamId}.`);
      }
      return team;
    },
  }),
}));
