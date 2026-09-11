import { builder } from './builder';
import { greet } from './lib/greeting';

// #region query
builder.queryType({
  fields: (t) => ({
    greeting: t.string({
      nullable: false,
      args: { name: t.arg.string({ required: true }) },
      resolve: (_parent, args, context) => greet(args.name, context.locale),
    }),
  }),
});
// #endregion query

export const schema = builder.toSchema();
