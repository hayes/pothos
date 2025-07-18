import { loadManyCallback, loadOneCallback } from 'grafast';
import {
  type FriendshipRow,
  getFriendshipsByUserIds,
  getUsersByIds,
  type UserRow,
} from './business-logic';

export const userByIdCallback = loadOneCallback<
  number,
  Partial<UserRow> | null,
  Partial<UserRow> | null
>((ids, { attributes }) => getUsersByIds(ids, { columns: attributes }));

userByIdCallback.displayName = 'userById';

export const friendshipsByUserIdCallback = loadManyCallback<number, Partial<FriendshipRow>>(
  (ids, { attributes }) => getFriendshipsByUserIds(ids, { columns: attributes }),
);

friendshipsByUserIdCallback.displayName = 'friendshipsByUserId';
