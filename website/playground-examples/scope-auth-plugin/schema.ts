import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';

interface ITeam {
  id: string;
  name: string;
  wins: number;
  scoutingReport: string;
}

const Teams = new Map<string, ITeam>([
  ['comet', { id: 'comet', name: 'Comet', wins: 12, scoutingReport: 'Fast handlers, soft deep defense.' }],
  ['gulls', { id: 'gulls', name: 'Gulls', wins: 9, scoutingReport: 'Zone-heavy, tires in the fourth.' }],
]);

const builder = new SchemaBuilder<{
  Context: {
    viewer?: { id: string; role: 'member' | 'staff' };
  };
  // Each scope name maps to the type of the parameter its loader takes.
  AuthScopes: {
    public: boolean;
    member: boolean;
    staff: boolean;
  };
}>({
  plugins: [ScopeAuthPlugin],
  scopeAuth: {
    // The scope initializer runs once per request and builds that request's scopes.
    authScopes: async (context) => ({
      public: true,
      member: !!context.viewer,
      staff: context.viewer?.role === 'staff',
    }),
  },
});

const Team = builder.objectRef<ITeam>('Team');

Team.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    // Only signed-in members see the standings.
    wins: t.exposeInt('wins', {
      authScopes: {
        member: true,
      },
    }),
    // Scouting reports are staff-only.
    scoutingReport: t.exposeString('scoutingReport', {
      authScopes: {
        staff: true,
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Anyone can list the teams.
    teams: t.field({
      type: [Team],
      authScopes: {
        public: true,
      },
      resolve: () => [...Teams.values()],
    }),
  }),
});

export const schema = builder.toSchema();
