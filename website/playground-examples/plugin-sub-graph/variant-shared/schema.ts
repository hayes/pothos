// #region definitions
import SchemaBuilder from '@pothos/core';
import SubGraphPlugin from '@pothos/plugin-sub-graph';

const builder = new SchemaBuilder<{
  SubGraphs: 'Public' | 'Internal';
}>({
  plugins: [SubGraphPlugin],
  subGraphs: {
    defaultForTypes: ['Public', 'Internal'],
    fieldsInheritFromTypes: true,
  },
});

const Product = builder
  .objectRef<{
    id: string;
    name: string;
    internalNotes: string;
  }>('Product')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      internalNotes: t.exposeString('internalNotes', {
        subGraphs: ['Internal'],
      }),
    }),
  });

builder.queryType({
  fields: (t) => ({
    product: t.field({
      type: Product,
      resolve: () => ({ id: '1', name: 'Notebook', internalNotes: 'Restock next week' }),
    }),
  }),
});
// #endregion definitions
// #region selection
export const schema = builder.toSchema({ subGraph: { all: ['Internal', 'Public'] } });
// #endregion selection
