import SchemaBuilder from '@pothos/core';
import ValidationPlugin from '@pothos/plugin-validation';
import { z } from 'zod';

const builder = new SchemaBuilder({
  plugins: [ValidationPlugin],
});

interface IPlayer {
  id: string;
  name: string;
  email: string;
  jersey: number;
}

const roster = new Map<string, IPlayer>();

const Player = builder.objectRef<IPlayer>('Player').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    email: t.exposeString('email'),
    jersey: t.exposeInt('jersey'),
  }),
});

// #region register-mutation
builder.mutationType({
  fields: (t) => ({
    registerPlayer: t.field({
      type: Player,
      args: {
        name: t.arg.string({
          required: true,
          validate: z.string().min(2).max(50),
        }),
        email: t.arg.string({
          required: true,
          validate: z.email(),
        }),
        jersey: t.arg.int({
          required: true,
          validate: z.number().int().min(0).max(99),
        }),
      },
      resolve: (_root, args) => {
        const player: IPlayer = {
          id: String(roster.size + 1),
          name: args.name,
          email: args.email,
          jersey: args.jersey,
        };

        roster.set(player.id, player);

        return player;
      },
    }),
  }),
});
// #endregion register-mutation

// #region signup-input
const signUpRules = z
  .object({ email: z.string(), jersey: z.number(), backupJersey: z.number() })
  .refine((input: { jersey: number; backupJersey: number }) => input.jersey !== input.backupJersey, {
    message: 'Primary and backup jersey numbers must differ',
  });

const SignUp = builder.inputType('SignUp', {
  fields: (t) => ({
    email: t.string({
      required: true,
      validate: z.email(),
    }),
    jersey: t.int({ required: true }),
    backupJersey: t.int({ required: true }),
  }),
  validate: signUpRules,
});
// #endregion signup-input

builder.queryType({
  fields: (t) => ({
    roster: t.field({
      type: [Player],
      resolve: () => [...roster.values()],
    }),
    checkSignUp: t.boolean({
      args: {
        signUp: t.arg({ type: SignUp, required: true }),
      },
      resolve: () => true,
    }),
  }),
});

export const schema = builder.toSchema();
