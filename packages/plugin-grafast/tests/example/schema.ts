import { constant, each, lambda, loadMany, loadOne } from 'grafast';
import { defaultFieldResolver } from 'graphql';
import { builder } from './builder';
import type { UserRow } from './business-logic';
import { friendshipsByUserIdCallback, userByIdCallback } from './plans';

builder.queryType({
  fields: (t) => ({
    addTwoNumbers: t.int({
      args: {
        a: t.arg.int({ required: true }),
        b: t.arg.int({ required: true }),
      },
      plan: (_, args) => {
        return lambda([args.$a, args.$b], ([a, b]) => a + b, true);
      },
      // Pothos currently requires a resolver when not using t.expose*
      // defaultFieldResolver is stripped out by Pothos if it is not wrapped by a plugin
      resolve: defaultFieldResolver as never,
    }),
    currentUser: t.field({
      type: User,
      extensions: {
        grafast: {
          plan: () => loadOne(constant(1), userByIdCallback),
        },
      },
      resolve: defaultFieldResolver as never,
    }),
  }),
});

const User = builder.objectRef<UserRow>('User');

User.implement({
  description: 'A user',
  fields: (t) => ({
    id: t.exposeID('id'),
    bio: t.exposeString('bio'),
    name: t.exposeString('full_name'),
    friends: t.field({
      type: [User],
      plan: ($user) => {
        console.log('user', $user);
        const $friendships = loadMany($user.get('id'), friendshipsByUserIdCallback);

        const $friends = each($friendships, ($friendship) => {
          const $friendId = $friendship.get('friend_id');

          return loadOne($friendId, userByIdCallback);
        });
        return $friends;
      },
      resolve: defaultFieldResolver as never,
    }),
  }),
});

export const schema = builder.toSchema({});
