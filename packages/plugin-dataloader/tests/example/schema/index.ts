import { createContextCache } from '@giraphql/core';
import { rejectErrors } from '../../../src';
import builder from '../builder';
import { ContextType, IPost } from '../types';

const usersCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
const userNodeCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
const postsCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
const postCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));

function countCall(context: ContextType, getCounts: typeof usersCounts, loaded: number) {
  const group = getCounts(context);
  group.calls += 1;
  group.loaded += loaded;

  return group;
}

const TestInterface = builder.interfaceRef<{ id: number }>('TestInterface').implement({
  fields: (t) => ({
    idFromInterface: t.exposeID('id', {}),
  }),
});

export const User = builder.loadableObject('User', {
  interfaces: [TestInterface],
  isTypeOf: (obj) => true,
  loaderOptions: { maxBatchSize: 20 },
  load: (keys: string[], context: ContextType) => {
    countCall(context, usersCounts, keys.length);
    return Promise.resolve(
      keys.map((id) => (Number(id) > 0 ? { id: Number(id) } : new Error(`Invalid ID ${id}`))),
    );
  },
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});

const UserNode = builder.loadableNode('UserNode', {
  interfaces: [TestInterface],
  id: {
    resolve: (user) => user.id,
  },
  isTypeOf: (obj) =>
    typeof obj === 'object' && obj !== null && Object.prototype.hasOwnProperty.call(obj, 'id'),
  loaderOptions: { maxBatchSize: 20 },
  load: (keys: string[], context: ContextType) => {
    countCall(context, userNodeCounts, keys.length);
    return Promise.resolve(
      keys.map((id) => (Number(id) > 0 ? { id: Number(id) } : new Error(`Invalid ID ${id}`))),
    );
  },
  fields: (t) => ({}),
});

const Post = builder.objectRef<IPost>('Post').implement({
  fields: (t) => ({
    id: t.exposeID('id', {}),
    title: t.exposeString('title', {}),
    content: t.exposeString('title', {}),
  }),
});

const Count = builder
  .objectRef<{ name: string; calls: number; loaded: number }>('CallCount')
  .implement({
    fields: (t) => ({
      name: t.exposeString('name', {}),
      calls: t.exposeInt('calls', {}),
      loaded: t.exposeInt('loaded', {}),
    }),
  });

User.getDataloader(({} as unknown) as ContextType);
// @ts-expect-error not valid context
User.getDataloader({});

builder.objectField(User, 'self', (t) =>
  t.loadable({
    type: User,
    load: (ids: number[]) => Promise.resolve(ids.map((id) => ({ id }))),
    resolve: (user, args) => user.id,
  }),
);

builder.queryField('addOnUser', (t) =>
  t.field({
    type: User,
    resolve: (parent, args, context) => {
      const loader = User.getDataloader(context);

      return loader.load('123');
    },
  }),
);

builder.queryType({});

builder.queryFields((t) => ({
  counts: t.field({
    type: [Count],
    resolve: async (root, args, context) => {
      await new Promise((resolve) => {
        setTimeout(() => void resolve(null), 5);
      });

      return [
        { name: 'users', ...usersCounts(context) },
        { name: 'userNodes', ...userNodeCounts(context) },
        { name: 'posts', ...postsCounts(context) },
        { name: 'post', ...postCounts(context) },
      ];
    },
  }),
  user: t.field({
    type: User,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (root, args) => args.id ?? '1',
  }),
  users: t.field({
    type: [User],
    nullable: {
      list: true,
      items: true,
    },
    args: {
      ids: t.arg.stringList(),
    },
    resolve: (_root, args) => args.ids ?? ['123', '456', '789'],
  }),
  userNode: t.field({
    type: User,
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
  fromContext1: t.field({
    type: User,
    resolve: (root, args, { userLoader }) => userLoader.load('123'),
  }),
  fromContext2: t.field({
    type: User,
    resolve: (root, args, { getLoader }) => getLoader(User).load('456'),
  }),
  fromContext3: t.field({
    type: User,
    resolve: (root, args, { load }) => load(User, '789'),
  }),
  fromContext4: t.field({
    type: [User],
    resolve: (root, args, { loadMany }) => rejectErrors(loadMany(User, ['123', '456'])),
  }),
  fromContext5: t.field({
    type: [User],
    resolve: (root, args, context) =>
      rejectErrors(User.getDataloader(context).loadMany(['123', '345'])),
  }),
  post: t.loadable({
    type: Post,
    nullable: true,
    args: {
      id: t.arg.int({
        required: true,
      }),
    },
    load: (ids: number[], context) => {
      countCall(context, postCounts, ids.length);

      return Promise.resolve(
        ids.map((id) =>
          id > 0
            ? { id, title: `${id} title`, content: `${id} content` }
            : new Error(`Invalid ID ${id}`),
        ),
      );
    },
    resolve: (_root, args) => Promise.resolve(args.id),
  }),
  posts: t.loadable({
    type: [Post],
    nullable: {
      list: true,
      items: true,
    },
    args: {
      ids: t.arg.intList({
        required: true,
      }),
    },
    load: (ids: number[], context) => {
      countCall(context, postsCounts, ids.length);

      return Promise.resolve(
        ids.map((id) =>
          id > 0
            ? { id, title: `${id} title`, content: `${id} content` }
            : new Error(`Invalid ID ${id}`),
        ),
      );
    },
    resolve: (_root, args) => Promise.resolve(args.ids),
  }),
}));

export default builder.toSchema({});
