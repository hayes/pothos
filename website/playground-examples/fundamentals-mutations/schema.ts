import SchemaBuilder from '@pothos/core';

interface ITeam {
  id: number;
  name: string;
  captainId: number;
}

const Teams = new Map<number, ITeam>([
  [1, { id: 1, name: 'Comet', captainId: 1 }],
]);

interface Context {
  user?: { id: number };
}

const builder = new SchemaBuilder<{
  Context: Context;
}>({});

const Team = builder.objectRef<ITeam>('Team');

Team.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    teams: t.field({
      type: [Team],
      resolve: () => [...Teams.values()],
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    renameTeam: t.field({
      type: Team,
      args: {
        input: t.arg({
          type: builder.inputType('RenameTeamInput', {
            fields: (t) => ({
              teamId: t.id({ required: true }),
              name: t.string({ required: true }),
            }),
          }),
          required: true,
        }),
      },
      resolve: (_root, { input }, ctx) => {
        // Core-only auth check. Plugins like plugin-scope-auth replace
        // this boilerplate with declarative scopes; see the link below.
        if (!ctx.user) {
          throw new Error('Not signed in');
        }
        const team = Teams.get(Number(input.teamId));
        if (!team) {
          throw new Error(`No team with id ${input.teamId}`);
        }
        if (team.captainId !== ctx.user.id) {
          throw new Error('Only the captain can rename the team');
        }
        team.name = input.name;
        return team;
      },
    }),
  }),
});

export const schema = builder.toSchema();
