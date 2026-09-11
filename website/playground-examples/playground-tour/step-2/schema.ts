import SchemaBuilder from '@pothos/core';
import { type Giraffe as GiraffeModel, giraffes } from './models/giraffe';

const builder = new SchemaBuilder({});

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
