/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/promise-function-async */
import { db } from './database';

const logSql = process.env.LOG_SQL === '1';

function queryAll<T = unknown>(query: string, parameters: unknown) {
  return new Promise<T[]>((resolve, reject) => {
    if (logSql) {
      console.log({ query, parameters });
    }
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    return db.all(query, parameters, (err, result) => (err ? reject(err) : resolve(result as T[])));
  });
}

interface GetUserOptions {
  columns?: readonly (keyof UserRow)[] | null;
}

interface GetFriendshipOptions {
  columns?: readonly (keyof FriendshipRow)[] | null;
}

export interface UserRow {
  id: number;
  full_name: string;
  username: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

export interface FriendshipRow {
  id: number;
  user_id: number;
  friend_id: number;
  created_at: string;
  updated_at: string;
}

export async function getUsersByIds(
  ids: readonly number[],
  options: GetUserOptions = {},
): Promise<(UserRow | null)[]> {
  console.log('getUsersByIds', ids, options);
  const columns = options.columns ? [...new Set(['id', ...options.columns])] : ['*'];

  const users = await queryAll<UserRow>(
    `select ${columns.join(', ')} from users where id in (${ids.map(() => '?').join(', ')})`,
    ids,
  );

  return ids.map((id) => users.find((u) => u.id === id) ?? null);
}

export async function getFriendshipsByUserIds(
  userIds: readonly number[],
  options: GetFriendshipOptions = {},
) {
  console.log('getFriendshipsByUserIds', userIds, options);
  const columns = options.columns ? [...new Set(['user_id', ...options.columns])] : ['*'];
  const friendships = await queryAll<FriendshipRow>(
    `select ${columns.join(', ')} from friendships where user_id in (${userIds
      .map(() => '?')
      .join(', ')})`,
    userIds,
  );
  return userIds.map((userId) => friendships.filter((f) => f.user_id === userId));
}
