import SchemaBuilder from '@pothos/core';
import DirectivePlugin from '@pothos/plugin-directives';

interface ITeam {
  id: number;
  name: string;
}

const Teams = new Map<number, ITeam>([
  [1, { id: 1, name: 'Comet' }],
  [2, { id: 2, name: 'Nova' }],
]);

const builder = new SchemaBuilder<{
  Directives: {
    rateLimit: {
      locations: 'OBJECT' | 'FIELD_DEFINITION';
      args: { limit: number; duration: number };
    };
    auth: {
      locations: 'FIELD_DEFINITION';
      args: { role: string };
    };
  };
}>({
  plugins: [DirectivePlugin],
  directives: {
    useGraphQLToolsUnorderedDirectives: true,
  },
});

const Team = builder.objectRef<ITeam>('Team');

Team.implement({
  // Object form: a map of directive name to its args.
  directives: {
    rateLimit: { limit: 60, duration: 60 },
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    teams: t.field({
      type: [Team],
      directives: {
        rateLimit: { limit: 5, duration: 60 },
      },
      resolve: () => [...Teams.values()],
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    renameTeam: t.field({
      type: Team,
      // Array form: preserves order and allows repeats.
      directives: [{ name: 'auth', args: { role: 'admin' } }],
      args: {
        id: t.arg.id({ required: true }),
        name: t.arg.string({ required: true }),
      },
      resolve: (_root, { id, name }) => {
        const team = Teams.get(Number(id));
        if (!team) {
          throw new Error(`No team with id ${id}`);
        }
        team.name = name;
        return team;
      },
    }),
  }),
});

export const schema = builder.toSchema();
