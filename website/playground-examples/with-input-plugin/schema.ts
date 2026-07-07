import SchemaBuilder from '@pothos/core';
import WithInputPlugin from '@pothos/plugin-with-input';

interface ITeam {
  id: number;
  name: string;
  wins: number;
}

const Teams = new Map<number, ITeam>([
  [1, { id: 1, name: 'Comet', wins: 8 }],
  [2, { id: 2, name: 'Riptide', wins: 5 }],
]);

let nextId = 3;

const builder = new SchemaBuilder({
  plugins: [WithInputPlugin],
});

const Team = builder.objectRef<ITeam>('Team').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    wins: t.exposeInt('wins'),
  }),
});

builder.queryType({
  fields: (t) => ({
    // fieldWithInput generates a QueryTeamInput type and an `input` argument.
    team: t.fieldWithInput({
      type: Team,
      nullable: true,
      input: {
        id: t.input.id({ required: true }),
      },
      resolve: (_root, args) => Teams.get(Number(args.input.id)) ?? null,
    }),
    // argOptions.required: false makes the whole input argument optional.
    searchTeams: t.fieldWithInput({
      type: [Team],
      argOptions: { required: false },
      input: {
        namePrefix: t.input.string({ required: true }),
      },
      resolve: (_root, args) => {
        const prefix = args.input?.namePrefix;
        const teams = [...Teams.values()];
        return prefix ? teams.filter((team) => team.name.startsWith(prefix)) : teams;
      },
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    // Several input fields collapse into one MutationRenameTeamInput type.
    renameTeam: t.fieldWithInput({
      type: Team,
      nullable: true,
      input: {
        id: t.input.id({ required: true }),
        name: t.input.string({ required: true }),
      },
      resolve: (_root, args) => {
        const team = Teams.get(Number(args.input.id));
        if (!team) {
          return null;
        }
        team.name = args.input.name;
        return team;
      },
    }),
    // typeOptions.name and argOptions.name rename the generated type and arg.
    createTeam: t.fieldWithInput({
      type: Team,
      typeOptions: { name: 'NewTeamInput' },
      argOptions: { name: 'team' },
      input: {
        name: t.input.string({ required: true }),
      },
      resolve: (_root, args) => {
        const team: ITeam = { id: nextId++, name: args.team.name, wins: 0 };
        Teams.set(team.id, team);
        return team;
      },
    }),
  }),
});

export const schema = builder.toSchema();
