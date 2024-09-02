import { resolveArrayConnection, resolveOffsetConnection } from '../../../../src';
import builder from '../builder';

class NumberThing {
  id: number;

  constructor(n: number) {
    if (typeof n !== 'number') {
      throw new TypeError(`Expected NumberThing to receive number, saw ${typeof n} ${n}`);
    }
    this.id = n;
  }
}

class BatchLoadableNumberThing {
  id: number;

  constructor(n: number) {
    if (typeof n !== 'number') {
      throw new TypeError(
        `Expected BatchLoadableNumberThing to receive number, saw ${typeof n} ${n}`,
      );
    }
    this.id = n;
  }
}

builder.node(NumberThing, {
  id: {
    resolve: (n) => n.id,
  },
  loadOne: (id) => new NumberThing(Number.parseInt(id, 10)),
  name: 'Number',
  fields: (t) => ({
    number: t.exposeInt('id', {}),
  }),
});

builder.node(BatchLoadableNumberThing, {
  id: {
    resolve: (n) => n.id,
  },
  loadMany: (ids) => ids.map((id) => new BatchLoadableNumberThing(Number.parseInt(id, 10))),
  name: 'BatchNumber',
  fields: (t) => ({
    number: t.exposeInt('id', {}),
  }),
});

builder.queryFields((t) => ({
  numbers: t.connection(
    {
      type: NumberThing,
      resolve: async (_parent, args) => {
        const result = await resolveOffsetConnection({ args }, ({ limit, offset }) => {
          const items = [];

          for (let i = offset; i < Math.min(offset + limit, 200); i += 1) {
            items.push(new NumberThing(i));
          }

          return items;
        });

        return {
          other: 'abc',
          ...result,
          totalCount: 500,
        };
      },
    },
    {
      fields: (t2) => ({
        other: t2.exposeString('other'),
      }),
    },
  ),
}));

builder.queryFields((t) => ({
  nullableNumbers: t.connection(
    {
      type: NumberThing,
      nullable: true,
      resolve: async (_parent, args) => {
        const result = await resolveOffsetConnection({ args }, () => null as NumberThing[] | null);

        if (!result) {
          return null;
        }

        return {
          other: 'abc',
          ...result,
          totalCount: 500,
        };
      },
    },
    {
      fields: (t2) => ({
        other: t2.exposeString('other'),
      }),
    },
  ),
  oddNumbers: t.connection({
    type: NumberThing,
    edgesNullable: {
      items: true,
      list: false,
    },
    nodeNullable: false,
    resolve: async (_parent, args) => {
      const result = await resolveOffsetConnection({ args }, () => [
        new NumberThing(1),
        null,
        new NumberThing(3),
      ]);

      return {
        other: 'abc',
        ...result,
        totalCount: 500,
      };
    },
  }),
}));

builder.queryFields((t) => ({
  batchNumbers: t.connection({
    type: BatchLoadableNumberThing,
    resolve: (_parent, args) => {
      const numbers: BatchLoadableNumberThing[] = [];

      for (let i = 0; i < 200; i += 1) {
        numbers.push(new BatchLoadableNumberThing(i));
      }

      return resolveArrayConnection({ args }, numbers);
    },
  }),
  extraNode: t.node({
    id: () => 'TnVtYmVyOjI=',
  }),
  moreNodes: t.nodeList({
    ids: () => ['TnVtYmVyOjI=', { id: 10, type: NumberThing }],
  }),
}));

const SharedConnection = builder.connectionObject({
  name: 'SharedConnection',
  type: NumberThing,
});

builder.queryField('sharedConnection', (t) =>
  t.field({
    type: SharedConnection,
    nullable: true,
    args: {
      ...t.arg.connectionArgs(),
    },
    resolve: async (_root, args) => {
      const result = await resolveOffsetConnection({ args }, ({ limit, offset }) => {
        const items = [];

        for (let i = offset; i < Math.min(offset + limit, 200); i += 1) {
          items.push(new NumberThing(i));
        }

        return items;
      });

      return {
        ...result,
        totalCount: 500,
      };
    },
  }),
);
