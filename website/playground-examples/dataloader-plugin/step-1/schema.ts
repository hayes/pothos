import SchemaBuilder from '@pothos/core';
// #region setup
import DataloaderPlugin from '@pothos/plugin-dataloader';

const builder = new SchemaBuilder({
  plugins: [DataloaderPlugin],
});
// #endregion setup

interface IPlayer {
  id: string;
  name: string;
  number: number;
}

// In-memory roster. In a real app `load` would hit a database instead.
const players = new Map<string, IPlayer>([
  ['1', { id: '1', name: 'Dax Carter', number: 7 }],
  ['2', { id: '2', name: 'Rowan Vale', number: 11 }],
  ['3', { id: '3', name: 'Kit Nakamura', number: 4 }],
]);

// #region player
const Player = builder.loadableObject('Player', {
  // Called once per request with every id the query touched. Return one result
  // per id, in the same order — an Error in a slot fails just that player.
  load: async (ids: string[]) => {
    console.log('loading players', ids);
    return ids.map((id) => players.get(id) ?? new Error(`No player ${id}`));
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    number: t.exposeInt('number'),
  }),
});
// #endregion player

// #region query
builder.queryType({
  fields: (t) => ({
    // Return the id; the loader turns it into a Player.
    player: t.field({
      type: Player,
      args: { id: t.arg.string({ required: true }) },
      resolve: (_root, args) => args.id,
    }),
    // A list of ids batches into a single load call.
    roster: t.field({
      type: [Player],
      args: { ids: t.arg.stringList({ required: true }) },
      resolve: (_root, args) => args.ids,
    }),
  }),
});
// #endregion query

export const schema = builder.toSchema();
