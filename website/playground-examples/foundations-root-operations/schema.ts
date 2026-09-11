// #region query
import SchemaBuilder from '@pothos/core';

type Giraffe = { name: string };

const builder = new SchemaBuilder({});
const giraffes: Giraffe[] = [{ name: 'James' }];

const GiraffeRef = builder.objectRef<Giraffe>('Giraffe').implement({
  fields: (t) => ({
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      resolve: () => 'hello, world!',
    }),
    giraffes: t.field({
      type: [GiraffeRef],
      resolve: () => giraffes,
    }),
  }),
});
// #endregion query

// #region mutation
builder.mutationType({});

builder.mutationField('createGiraffe', (t) =>
  t.field({
    type: GiraffeRef,
    args: {
      name: t.arg.string({ required: true }),
    },
    resolve: (_parent, args) => {
      const giraffe = { name: args.name };
      giraffes.push(giraffe);
      return giraffe;
    },
  }),
);

export const schema = builder.toSchema();
// #endregion mutation
