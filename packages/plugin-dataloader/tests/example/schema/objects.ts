import { rejectErrors } from '../../../src';
import builder from '../builder';
import { ContextType } from '../types';
import { countCall, nullableUsersCounts, preloadedUsersCounts, usersCounts } from './counts';
import { TestInterface } from './interfaces';

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

const PreloadedUser = builder.loadableObject('PreloadedUser', {
  interfaces: [TestInterface],
  isTypeOf: (obj) => true,
  loaderOptions: { maxBatchSize: 20 },
  load: (keys: string[], context: ContextType) => {
    countCall(context, preloadedUsersCounts, keys.length);
    return Promise.resolve(
      keys.map((id) => (Number(id) > 0 ? { id: Number(id) } : new Error(`Invalid ID ${id}`))),
    );
  },
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
  cacheResolved: ({ id }) => id.toString(),
});

User.getDataloader({} as unknown as ContextType);
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

const NullableUser = builder.loadableObject('NullableUser', {
  interfaces: [TestInterface],
  isTypeOf: (obj) => true,
  loaderOptions: { maxBatchSize: 20 },
  load: (keys: string[], context: ContextType) => {
    countCall(context, nullableUsersCounts, keys.length);
    return Promise.resolve(
      keys.map((id) => (Number(id) > 0 ? { id: Number(id) } : (null as never))),
    );
  },
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});

builder.queryFields((t) => ({
  user: t.field({
    type: User,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (root, args) => args.id ?? '1',
  }),
  userWithErrors: t.field({
    errors: {},
    type: User,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (root, args) => args.id ?? '-1',
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
  usersWithErrors: t.field({
    errors: {},
    type: [User],
    nullable: true,
    args: {
      ids: t.arg.stringList(),
    },
    resolve: (root, args) => {
      if (!args.ids) {
        throw new Error('Ids required');
      }

      return args.ids;
    },
  }),
  preloadedUser: t.field({
    type: PreloadedUser,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (root, args) => args.id ?? '1',
  }),
  preloadedUsers: t.field({
    type: [PreloadedUser],
    nullable: {
      list: true,
      items: true,
    },
    args: {
      ids: t.arg.stringList(),
    },
    resolve: (_root, args) => (args.ids ?? []).map((id) => ({ id: Number(id) })),
  }),
  nullableUser: t.field({
    type: NullableUser,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (root, args) => args.id ?? '-1',
  }),
  nullableUsers: t.field({
    type: [NullableUser],
    nullable: {
      list: true,
      items: true,
    },
    args: {
      ids: t.arg.stringList(),
    },
    resolve: (_root, args) => args.ids ?? ['123', '-456', '789'],
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
}));
