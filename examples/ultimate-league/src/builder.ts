import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import ValidationPlugin from '@pothos/plugin-validation';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { AuthContexts, BaseContext } from './context.ts';
import { type DrizzleRelations, db, relations } from './db.ts';

export interface PothosTypes {
  DrizzleRelations: DrizzleRelations;
  Context: BaseContext;
  AuthScopes: {
    /** Any authenticated user. */
    loggedIn: boolean;
    /** Holds a global `admin` UserRole. */
    admin: boolean;
    /** Captain of the team with the given id. */
    teamCaptain: number;
    /** Captain or player on the team with the given id. */
    teamMember: number;
  };
  AuthContexts: AuthContexts;
}

export const builder = new SchemaBuilder<PothosTypes>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin, ValidationPlugin],
  drizzle: {
    client: (_ctx) => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: (ctx) => ({
      loggedIn: !!ctx.user,
      admin: ctx.roles.includes('admin'),
      teamCaptain: (teamId: number) => ctx.teamRoles.get(teamId) === 'captain',
      teamMember: (teamId: number) => ctx.teamRoles.has(teamId),
    }),
  },
});

builder.queryType({});
builder.mutationType({});
