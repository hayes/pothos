import { constant, each, lambda, loadMany, loadOne } from 'grafast';
import { builder } from './builder';
import type { UserRow } from './business-logic';
import { friendshipsByUserIdCallback, userByIdCallback } from './plans';
import './polymorphic';

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
    }),
    currentUser: t.field({
      type: User,
      plan: () => loadOne(constant(1), userByIdCallback),
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
    }),
  }),
});

export const schema = builder.toSchema({});
