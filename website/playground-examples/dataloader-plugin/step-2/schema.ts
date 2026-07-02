import SchemaBuilder from '@pothos/core';
import DataloaderPlugin from '@pothos/plugin-dataloader';

const builder = new SchemaBuilder({
  plugins: [DataloaderPlugin],
});

interface ITeam {
  id: string;
  name: string;
}

interface IPlayer {
  id: string;
  name: string;
  teamId: string;
}

const teams = new Map<string, ITeam>([
  ['comet', { id: 'comet', name: 'Comet' }],
  ['aurora', { id: 'aurora', name: 'Aurora' }],
]);

const players: IPlayer[] = [
  { id: '1', name: 'Dax Carter', teamId: 'comet' },
  { id: '2', name: 'Rowan Vale', teamId: 'comet' },
  { id: '3', name: 'Kit Nakamura', teamId: 'aurora' },
];

const Player = builder.objectRef<IPlayer>('Player').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

const Team = builder.loadableObject('Team', {
  load: async (ids: string[]) => {
    console.log('loading teams', ids);
    return ids.map((id) => teams.get(id) ?? new Error(`No team ${id}`));
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    // One load call fetches the roster for every team in the query at once.
    // `load` returns a flat list; `group` sorts each player back to its team.
    players: t.loadableGroup({
      type: Player,
      load: async (teamIds: string[]) => {
        console.log('loading rosters', teamIds);
        return players.filter((player) => teamIds.includes(player.teamId));
      },
      group: (player: IPlayer) => player.teamId,
      resolve: (team: ITeam) => team.id,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    team: t.field({
      type: Team,
      args: { id: t.arg.string({ required: true }) },
      resolve: (_root, args) => args.id,
    }),
    // Returning a list of ids batches every team through one load call.
    teams: t.field({
      type: [Team],
      resolve: () => [...teams.keys()],
    }),
  }),
});

export const schema = builder.toSchema();
