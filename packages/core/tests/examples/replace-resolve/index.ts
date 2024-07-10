import builder from './builder';

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      resolve2: () => 'world',
    }),
  }),
});

const schema = builder.toSchema();

export default schema;
