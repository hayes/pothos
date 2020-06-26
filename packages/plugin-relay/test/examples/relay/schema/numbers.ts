import builder from '../builder';
import { resolveOffsetConnection, resolveArrayConnection } from '../../../../src';

class NumberThing {
  __type = NumberThing;

  id: number;

  constructor(n: number) {
    this.id = n;
  }
}

class BatchLoadableNumberThing {
  __type = BatchLoadableNumberThing;

  id: number;

  constructor(n: number) {
    this.id = n;
  }
}

builder.node(NumberThing, {
  loadOne: (id) => new NumberThing(parseInt(id)),
  name: 'Number',
  fields: (t) => ({
    number: t.exposeInt('id', {}),
  }),
});

builder.node(BatchLoadableNumberThing, {
  loadMany: (ids) => ids.map((id) => new BatchLoadableNumberThing(parseInt(id))),
  name: 'BatchNumber',
  fields: (t) => ({
    number: t.exposeInt('id', {}),
  }),
});

builder.queryFields((t) => ({
  numbers: t.connection(
    {
      type: NumberThing,
      resolve: (parent, args) => {
        return resolveOffsetConnection({ args }, ({ limit, offset }) => {
          const items = [];

          for (let i = offset; i < Math.min(offset + limit, 200); ++i) {
            items.push(new NumberThing(i));
          }

          return items;
        });
      },
    },
    {},
    {},
  ),
}));

builder.queryFields((t) => ({
  batchNumbers: t.connection(
    {
      type: BatchLoadableNumberThing,
      resolve: (parent, args) => {
        const numbers: BatchLoadableNumberThing[] = [];

        for (let i = 0; i < 200; ++i) {
          numbers.push(new BatchLoadableNumberThing(i));
        }

        return resolveArrayConnection({ args }, numbers);
      },
    },
    {},
    {},
  ),
  extraNode: t.node({
    id: () => 'TnVtYmVyOjI=',
  }),
  moreNodes: t.nodeList({
    ids: () => ['TnVtYmVyOjI=', { id: 10, type: NumberThing }],
  }),
}));
