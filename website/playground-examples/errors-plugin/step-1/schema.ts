import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';

// #region builder-setup
const builder = new SchemaBuilder({
  plugins: [ErrorsPlugin],
  errors: {
    defaultTypes: [],
    // onResolvedError: (error) => console.error('Handled error:', error),
  },
});
// #endregion builder-setup

interface ITeam {
  id: number;
  name: string;
}

const Teams = new Map<number, ITeam>([
  [1, { id: 1, name: 'Comet' }],
  [2, { id: 2, name: 'Aurora' }],
  [3, { id: 3, name: 'Vertex' }],
]);

// #region error-body
const Team = builder.objectRef<ITeam>('Team').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.objectType(Error, {
  name: 'Error',
  fields: (t) => ({
    message: t.exposeString('message'),
  }),
});

builder.queryType({
  fields: (t) => ({
    team: t.field({
      type: Team,
      errors: {
        types: [Error],
      },
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_parent, { id }) => {
        const team = Teams.get(Number(id));
        if (!team) {
          throw new Error(`No team with id ${id}`);
        }
        return team;
      },
    }),
  }),
});
// #endregion error-body

export const schema = builder.toSchema();
