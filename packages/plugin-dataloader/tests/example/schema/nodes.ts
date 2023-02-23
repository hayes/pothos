import builder from '../builder';
import { ContextType } from '../types';
import { countCall, userNodeCounts } from './counts';
import { TestInterface } from './interfaces';

const UserNode = builder.loadableNodeRef('UserNode', {
  id: {
    resolve: (user) => user.id,
  },
  loaderOptions: { maxBatchSize: 20 },
  load: (keys: string[], context: ContextType) => {
    countCall(context, userNodeCounts, keys.length);
    return Promise.resolve(
      keys.map((id) =>
        Number(id) > 0 ? { objType: 'UserNode', id: Number(id) } : new Error(`Invalid ID ${id}`),
      ),
    );
  },
});

builder.objectType(UserNode, {
  interfaces: [TestInterface],
  isTypeOf: (obj) => (obj as any).objType === 'UserNode',
  fields: (t) => ({}),
});

class ClassThing {
  id: number;
  name: string = 'some name';
  constructor(id = 123) {
    this.id = id;
  }
}

const ClassThingRef = builder.loadableNode(ClassThing, {
  name: 'ClassLoadableThing',
  interfaces: [TestInterface],
  id: {
    resolve: (user) => user.id,
  },
  loaderOptions: { maxBatchSize: 20 },
  // eslint-disable-next-line @typescript-eslint/require-await
  load: async (keys: string[], context: ContextType) =>
    keys.map((k) => new ClassThing(Number.parseInt(k, 10))),
  fields: (t) => ({}),
});

builder.queryFields((t) => ({
  userNode: t.field({
    type: UserNode,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (root, args) => args.id ?? '1',
  }),
  userNodes: t.field({
    type: [UserNode],
    nullable: {
      list: true,
      items: true,
    },
    args: {
      ids: t.arg.stringList(),
    },
    resolve: (_root, args) => args.ids ?? ['123', '456', '789'],
  }),
  classThing: t.field({
    type: ClassThing,
    resolve: () => new ClassThing(),
  }),
  classThingRef: t.field({
    type: ClassThingRef,
    resolve: () => '1',
  }),
}));
