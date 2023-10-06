import { loadManyCallback, loadOneCallback } from 'grafast';
import { FriendshipRow, getFriendshipsByUserIds, getUsersByIds, UserRow } from './business-logic';

export const userByIdCallback = loadOneCallback<number, Partial<UserRow> | null, Partial<UserRow>>(
  (ids, { attributes }) => getUsersByIds(ids, { columns: attributes }),
);

userByIdCallback.displayName = 'userById';

export const friendshipsByUserIdCallback = loadManyCallback<
  number,
  Partial<FriendshipRow>,
  Partial<FriendshipRow>
>((ids, { attributes }) => getFriendshipsByUserIds(ids, { columns: attributes }));

friendshipsByUserIdCallback.displayName = 'friendshipsByUserId';
