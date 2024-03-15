import { PageInfoShape, resolveArrayConnection, resolveOffsetConnection } from '../../../../src';
import builder from '../builder';

class IDWithColon {
  id: string;

  constructor(id: string) {
    if (!id.includes(':')) {
      throw new TypeError(`Expected id to have a colon, saw ${id}`);
    }
    this.id = id;
  }
}

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

const IDWithColonRef = builder.node(IDWithColon, {
  name: 'IDWithColon',
  id: {
    resolve: (n) => n.id,
  },
  fields: (t) => ({
    idString: t.exposeString('id'),
  }),
});

const NumberThingRef = builder.node(NumberThing, {
  id: {
    resolve: (n) => n.id,
    parse: (id) => Number.parseInt(id, 10),
  },
  loadOne: (id) => new NumberThing(id),
  name: 'Number',
  fields: (t) => ({
    number: t.exposeInt('id', {}),
  }),
});

const NumberRef = builder.node(builder.objectRef<NumberThing>('NumberRef'), {
  id: {
    resolve: (n) => n.id,
  },
  brandLoadedObjects: true,
  loadOne: (id) => ({ id: Number.parseInt(String(id), 10) }),
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
  numbers: t.connection({
    type: NumberThing,
    resolve: (parent, args) =>
      resolveOffsetConnection({ args }, ({ limit, offset }) => {
        const items = [];

        for (let i = offset; i < Math.min(offset + limit, 200); i += 1) {
          items.push(new NumberThing(i));
        }

        return items;
      }),
  }),
  oddNumbers: t.connection({
    type: NumberThing,
    resolve: (parent, args) =>
      resolveOffsetConnection({ args }, ({ limit, offset }) => {
        const items = [];

        for (let i = offset; i < Math.min(offset + limit, 200); i += 1) {
          items.push(i % 2 ? new NumberThing(i) : null);
        }

        return items;
      }),
  }),
}));

builder.queryFields((t) => ({
  batchNumbers: t.connection(
    {
      type: BatchLoadableNumberThing,
      resolve: (parent, args) => {
        const numbers: BatchLoadableNumberThing[] = [];

        for (let i = 0; i < 200; i += 1) {
          numbers.push(new BatchLoadableNumberThing(i));
        }

        return resolveArrayConnection({ args }, numbers);
      },
    },
    {
      fields: (u) => ({
        connectionField: u.int({
          nullable: true,
          resolve: (parent) => parent.edges.length,
        }),
      }),
    },
    {
      fields: (u) => ({
        edgeField: u.int({
          nullable: true,
          resolve: (parent) => parent?.node.id,
        }),
      }),
    },
  ),
  extraNode: t.node({
    id: () => 'TnVtYmVyOjI=',
  }),
  moreNodes: t.nodeList({
    ids: () => ['TnVtYmVyOjI=', { id: 10, type: NumberThing }],
  }),
  numberRef: t.field({
    type: NumberRef,
    resolve: () => ({ id: 123 }),
  }),
}));

class AssociatingReturnTypeExample {
  config;

  constructor(config: {
    edges: readonly { cursor: string; node: BatchLoadableNumberThing }[];
    pageInfo: PageInfoShape;
  }) {
    this.config = config;
  }

  get foo() {
    return 1;
  }

  get edges() {
    return this.config.edges.map((e) => ({
      ...e,
      bar: 1,
    }));
  }

  get pageInfo() {
    return Promise.resolve(this.config.pageInfo);
  }
}

builder.queryFields((t) => ({
  associatingReturnType: t.connection(
    {
      type: BatchLoadableNumberThing,
      resolve: (parent, args) => {
        const numbers: BatchLoadableNumberThing[] = [];

        for (let i = 0; i < 200; i += 1) {
          numbers.push(new BatchLoadableNumberThing(i));
        }

        return new AssociatingReturnTypeExample(resolveArrayConnection({ args }, numbers));
      },
    },
    {
      fields: (u) => ({
        connectionField: u.int({
          nullable: true,
          resolve: (parent) => {
            if (!parent.foo) {
              throw new Error('Expected to receive AssociatingReturnTypeExample');
            }
            return parent.edges.length;
          },
        }),
      }),
    },
    {
      fields: (u) => ({
        edgeField: u.int({
          nullable: true,
          resolve: (parent) => {
            if (parent.bar !== 1) {
              throw new Error('Expected to receive AssociatingReturnTypeExample');
            }
            return parent?.node.id;
          },
        }),
      }),
    },
  ),
}));

const SharedConnection = builder.connectionObject(
  {
    name: 'SharedConnection',
    type: NumberThing,
  },
  {
    name: 'SharedConnectionEdge',
  },
);

builder.queryField('sharedConnection', (t) =>
  t.field({
    type: SharedConnection,
    nullable: true,
    args: {
      ...t.arg.connectionArgs(),
    },
    resolve: (root, args) =>
      resolveOffsetConnection({ args }, ({ limit, offset }) => {
        const items = [];

        for (let i = offset; i < Math.min(offset + limit, 200); i += 1) {
          items.push(new NumberThing(i));
        }

        return items;
      }),
  }),
);

const SharedEdge = builder.edgeObject({
  name: 'SharedEdge',
  type: NumberThing,
});

const SharedConnectionAndEdge = builder.connectionObject(
  {
    name: 'SharedConnectionAndEdge',
    type: NumberThing,
  },
  SharedEdge,
);

builder.queryField('sharedConnectionAndEdge', (t) =>
  t.connection(
    {
      args: {
        complexity: t.arg.int(),
      },
      complexity: (args) => args.complexity ?? 1,
      type: NumberThing,
      resolve: (root, args) =>
        resolveOffsetConnection({ args }, ({ limit, offset }) => {
          const items = [];

          for (let i = offset; i < Math.min(offset + limit, 200); i += 1) {
            items.push(new NumberThing(i));
          }

          return items;
        }),
    },
    SharedConnectionAndEdge,
  ),
);

builder.queryField('sharedEdgeConnection', (t) =>
  t.connection(
    {
      complexity: (args, ctx) => args.first ?? 20,
      type: NumberThing,
      resolve: (root, args) =>
        resolveOffsetConnection({ args }, ({ limit, offset }) => {
          const items = [];

          for (let i = offset; i < Math.min(offset + limit, 200); i += 1) {
            items.push(new NumberThing(i));
          }

          return items;
        }),
    },
    {},
    SharedEdge,
  ),
);

builder.queryField('idWithColon', (t) =>
  t.field({
    type: IDWithColonRef,
    args: {
      id: t.arg.globalID({ required: true, for: [IDWithColonRef] }),
    },
    resolve: (root, args) => new IDWithColon(args.id.id),
  }),
);

builder.queryField('idsWithColon', (t) =>
  t.field({
    type: [IDWithColonRef],
    args: {
      ids: t.arg.globalIDList({ required: true, for: [IDWithColonRef] }),
    },
    resolve: (root, args) => args.ids.map((id) => new IDWithColon(id.id)),
  }),
);

builder.queryField('numberThingByID', (t) =>
  t.field({
    type: NumberThing,
    nullable: true,
    args: {
      id: t.arg.globalID({ required: true, for: [NumberThingRef] }),
    },
    resolve: (root, args) => new NumberThing(args.id.id),
  }),
);

builder.queryField('numberThingsByIDs', (t) =>
  t.field({
    type: [NumberThing],
    nullable: true,
    args: {
      ids: t.arg.globalIDList({ required: true, for: [NumberThingRef] }),
    },
    resolve: (root, args) => args.ids.map(({ id }) => new NumberThing(id)),
  }),
);

const IDResult = builder
  .objectRef<{
    id: unknown;
    typename: string;
    arg: string;
  }>('IDResult')
  .implement({
    fields: (t) => ({
      id: t.string({
        resolve: (n) => String(n.id),
      }),
      typename: t.exposeString('typename', {}),
      arg: t.exposeString('arg', {}),
      idType: t.string({
        resolve: (n) => typeof n.id,
      }),
    }),
  });

builder.queryField('echoIDs', (t) =>
  t.field({
    type: [IDResult],
    args: {
      globalID: t.arg.globalID({ required: true }),
      numberThingID: t.arg.globalID({ required: true, for: [NumberThingRef] }),
      genericNumberThingID: t.arg.globalID({ required: true, for: [NumberThing] }),
    },
    resolve: (_, args) => [
      { ...args.globalID, arg: 'globalID' },
      { ...args.numberThingID, arg: 'numberThingID' },
      { ...args.genericNumberThingID, arg: 'genericNumberThingID' },
    ],
  }),
);
