import { db } from './db.ts';

export type GlobalRole = 'admin';
export type TeamRoleName = 'captain' | 'player';

export interface BaseContext {
  user?: { id: number };
  /** Global role grants (currently just 'admin'). */
  roles: GlobalRole[];
  /** Per-team role for the current user, keyed by teamId. */
  teamRoles: Map<number, TeamRoleName>;
}

/**
 * Narrowed context shapes available inside `t.withAuth({ ... })` resolvers.
 * Once a scope is satisfied, `ctx.user` is guaranteed non-null.
 */
export interface AuthContexts {
  loggedIn: BaseContext & { user: { id: number } };
  admin: BaseContext & { user: { id: number } };
  teamCaptain: BaseContext & { user: { id: number } };
  teamMember: BaseContext & { user: { id: number } };
}

/**
 * Resolve the request's `x-user-id` header to a user record + their roles.
 * Falls back to an unauthenticated context if the header is missing or invalid.
 */
export async function createContext({ userId }: { userId?: string | null }): Promise<BaseContext> {
  if (!userId) {
    return { roles: [], teamRoles: new Map() };
  }
  const id = Number.parseInt(userId, 10);
  if (Number.isNaN(id)) {
    return { roles: [], teamRoles: new Map() };
  }
  const user = await db.query.users.findFirst({
    columns: { id: true },
    with: {
      userRoles: { columns: { role: true } },
      teamRoles: { columns: { teamId: true, role: true } },
    },
    where: { id },
  });
  if (!user) {
    return { roles: [], teamRoles: new Map() };
  }
  return {
    user: { id: user.id },
    roles: user.userRoles.map((r) => r.role),
    teamRoles: new Map(user.teamRoles.map((r) => [r.teamId, r.role])),
  };
}
