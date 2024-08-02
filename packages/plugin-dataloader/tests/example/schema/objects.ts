import { resolveArrayConnection } from '@pothos/plugin-relay';
import { GraphQLError } from 'graphql';
import { rejectErrors } from '../../../src';
import builder from '../builder';
import type { ContextType } from '../types';
import {
  countCall,
  nullableUsersCounts,
  preloadedUsersCounts,
  preloadedUsersToKeyCounts,
  sortedUsersCounts,
  sortedUsersToKeyCounts,
  usersCounts,
} from './counts';
import { TestInterface } from './interfaces';

export const User = builder.loadableObject('User', {
  interfaces: [TestInterface],
  isTypeOf: () => true,
  loaderOptions: { maxBatchSize: 20 },
  load: (keys: string[], context: ContextType) => {
    countCall(context, usersCounts, keys.length);

    return Promise.resolve(
      keys.map((id) =>
        Number(id) > 0 ? { id: Number(id) } : new GraphQLError(`Invalid ID ${id}`),
      ),
    );
  },
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
});

const UserFriendsConnection = builder.connectionObject({
  type: User,
  name: 'UserFriendsConnection',
});

builder.objectFields(User, (t) => ({
  friends: t.loadable({
    type: UserFriendsConnection,
    byPath: true,
    args: {
      ...t.arg.connectionArgs(),
    },
    load: async (users: { id: number }[], context, args) => {
      context.countCall('User.friends');

      return users.map((user) => {
        const friends: { objType: 'UserNode'; id: number }[] = [];
        for (let i = 0; i < 5; i += 1) {
          friends.push({ objType: 'UserNode', id: Number.parseInt(`${user.id}${i}`, 10) });
        }
        return resolveArrayConnection({ args }, friends);
      });
    },
    resolve: (user) => user,
  }),
  groupFriends: t.loadableGroup({
    byPath: true,
    type: User,
    args: {
      limit: t.arg.int({
        defaultValue: 5,
        required: true,
      }),
    },
    load: (ids, context, args) => {
      const friends = [];

      context.countCall('User.groupFriends');

      for (const id of ids) {
        for (let i = 0; i < args.limit; i += 1) {
          friends.push({ id: Number.parseInt(`${id}${i}`, 10) });
        }
      }

      return Promise.resolve(friends);
    },
    group: (user) => {
      const id = typeof user === 'string' ? user : String(user.id);

      return Number.parseInt(id.slice(0, -1), 10);
    },
    resolve: (user) => user.id,
  }),
}));

const PreloadedUser = builder.loadableObject('PreloadedUser', {
  interfaces: [TestInterface],
  isTypeOf: () => true,
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

const PreloadedUserToKey = builder.loadableObject('PreloadedUserToKey', {
  interfaces: [TestInterface],
  isTypeOf: () => true,
  loaderOptions: { maxBatchSize: 20 },
  load: (keys: string[], context: ContextType) => {
    countCall(context, preloadedUsersToKeyCounts, keys.length);
    return Promise.resolve(
      keys.map((id) => (Number(id) > 0 ? { id: Number(id) } : new Error(`Invalid ID ${id}`))),
    );
  },
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
  toKey: ({ id }) => id.toString(),
  cacheResolved: true,
});

const SortedUser = builder.loadableObject('SortedUser', {
  interfaces: [TestInterface],
  isTypeOf: () => true,
  loaderOptions: { maxBatchSize: 20 },
  load: (keys: string[], context: ContextType) => {
    countCall(context, sortedUsersCounts, keys.length);
    return Promise.resolve(
      keys
        .map((id) => (Number(id) > 0 ? { id: Number(id) } : new Error(`Invalid ID ${id}`)))
        .reverse(),
    );
  },
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
  sort: ({ id }) => id.toString(),
});

const SortedUserToKey = builder.loadableObject('SortedUserToKey', {
  interfaces: [TestInterface],
  isTypeOf: () => true,
  loaderOptions: { maxBatchSize: 20 },
  load: (keys: string[], context: ContextType) => {
    countCall(context, sortedUsersToKeyCounts, keys.length);
    return Promise.resolve(
      keys
        .map((id) => (Number(id) > 0 ? { id: Number(id) } : new Error(`Invalid ID ${id}`)))
        .reverse(),
    );
  },
  fields: (t) => ({
    id: t.exposeID('id', {}),
  }),
  toKey: ({ id }) => id.toString(),
  sort: true,
});

User.getDataloader({} as unknown as ContextType);
// @ts-expect-error not valid context
User.getDataloader({});

builder.objectField(User, 'self', (t) =>
  t.loadable({
    type: User,
    load: (ids: number[]) => Promise.resolve(ids.map((id) => ({ id }))),
    resolve: (user) => user.id,
  }),
);

builder.queryField('addOnUser', (t) =>
  t.field({
    type: User,
    resolve: (_parent, _args, context) => {
      const loader = User.getDataloader(context);

      return loader.load('123');
    },
  }),
);

const NullableUser = builder
  .loadableObjectRef('NullableUser', {
    loaderOptions: { maxBatchSize: 20 },
    load: (keys: string[], context: ContextType) => {
      countCall(context, nullableUsersCounts, keys.length);
      return Promise.resolve(
        keys.map((id) => (Number(id) > 0 ? { id: Number(id) } : (null as never))),
      );
    },
  })
  .implement({
    isTypeOf: () => true,
    interfaces: [TestInterface],
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
    resolve: (_root, args) => args.id ?? '1',
  }),
  userWithErrors: t.field({
    errors: {},
    type: User,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (_root, args) => args.id ?? '-1',
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
    resolve: (_root, args) => {
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
    resolve: (_root, args) => args.id ?? '1',
  }),
  preloadedUserToKey: t.field({
    type: PreloadedUserToKey,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (_root, args) => args.id ?? '1',
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
  preloadedUsersToKey: t.field({
    type: [PreloadedUserToKey],
    nullable: {
      list: true,
      items: true,
    },
    args: {
      ids: t.arg.stringList(),
    },
    resolve: (_root, args) => (args.ids ?? []).map((id) => ({ id: Number(id) })),
  }),
  sortedUser: t.field({
    type: SortedUser,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (_root, args) => args.id ?? '1',
  }),
  sortedUserToKey: t.field({
    type: SortedUserToKey,
    nullable: true,
    args: {
      id: t.arg.string(),
    },
    resolve: (_root, args) => args.id ?? '1',
  }),
  sortedUsers: t.field({
    type: [SortedUser],
    nullable: {
      list: true,
      items: true,
    },
    args: {
      ids: t.arg.stringList(),
    },
    resolve: (_root, args) => (args.ids ?? []).map((id) => ({ id: Number(id) })),
  }),
  sortedUsersToKey: t.field({
    type: [SortedUserToKey],
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
    resolve: (_root, args) => args.id ?? '-1',
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
    resolve: (_root, _args, { userLoader }) => userLoader.load('123'),
  }),
  fromContext2: t.field({
    type: User,
    resolve: (_root, _args, { getLoader }) => getLoader(User).load('456'),
  }),
  fromContext3: t.field({
    type: User,
    resolve: (_root, _args, { load }) => load(User, '789'),
  }),
  fromContext4: t.field({
    type: [User],
    resolve: (_root, _args, { loadMany }) => rejectErrors(loadMany(User, ['123', '456'])),
  }),
  fromContext5: t.field({
    type: [User],
    resolve: (_root, _args, context) =>
      rejectErrors(User.getDataloader(context).loadMany(['123', '345'])),
  }),
}));
