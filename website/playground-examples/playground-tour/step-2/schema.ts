import { builder } from './builder';
import { greet } from './lib/greeting';
import { giraffes, type Giraffe as GiraffeModel } from './models/giraffe';

// #region object
const Giraffe = builder.objectRef<GiraffeModel>('Giraffe');
Giraffe.implement({
  fields: (t) => ({
    name: t.exposeString('name', { nullable: false }),
    height: t.exposeFloat('height', { nullable: false }),
  }),
});
// #endregion object

// #region query
builder.queryType({
  fields: (t) => ({
    greeting: t.string({
      nullable: false,
      args: { name: t.arg.string({ required: true }) },
      resolve: (_parent, args, context) => greet(args.name, context.locale),
    }),
    giraffes: t.field({
      type: [Giraffe],
      nullable: false,
      args: { minimumHeight: t.arg.float({ required: true }) },
      resolve: (_parent, args) =>
        giraffes.filter((giraffe) => giraffe.height >= args.minimumHeight),
    }),
  }),
});
// #endregion query

export const schema = builder.toSchema();
