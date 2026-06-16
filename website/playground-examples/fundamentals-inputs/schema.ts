import SchemaBuilder from '@pothos/core';

interface IPlayer {
  id: number;
  name: string;
  jersey: number;
}

const Players = new Map<number, IPlayer>();
let nextId = 1;

const builder = new SchemaBuilder({});

const Player = builder.objectRef<IPlayer>('Player');

Player.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    jersey: t.exposeInt('jersey'),
  }),
});

builder.queryType({
  fields: (t) => ({
    players: t.field({
      type: [Player],
      resolve: () => [...Players.values()],
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createPlayer: t.field({
      type: Player,
      args: {
        // Inline inputType: the input's fields are declared right where
        // it's used. The shape is inferred — no separate inputRef needed.
        input: t.arg({
          type: builder.inputType('CreatePlayerInput', {
            fields: (t) => ({
              name: t.string({ required: true }),
              jersey: t.int({ required: true }),
            }),
          }),
          required: true,
        }),
      },
      resolve: (_root, { input }) => {
        const player: IPlayer = { id: nextId++, name: input.name, jersey: input.jersey };
        Players.set(player.id, player);
        return player;
      },
    }),
  }),
});

export const schema = builder.toSchema();
