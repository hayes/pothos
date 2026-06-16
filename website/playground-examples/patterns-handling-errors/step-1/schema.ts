import SchemaBuilder from '@pothos/core';

interface ITeam {
  id: number;
  name: string;
}

const Teams = new Map<number, ITeam>([
  [1, { id: 1, name: 'Comet' }],
]);

const builder = new SchemaBuilder({});

const Team = builder.objectRef<ITeam>('Team').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    team: t.field({
      type: Team,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, { id }) => {
        const team = Teams.get(Number(id));
        if (!team) {
          // Plain Error. Yoga returns the message in dev.
          throw new Error(`No team with id ${id}`);
        }
        return team;
      },
    }),
  }),
});

export const schema = builder.toSchema();
