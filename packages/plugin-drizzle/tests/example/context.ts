import type { PathInfo } from '../../src/types';
import { db } from './db';

export interface BaseContext {
  user?: {
    id: number;
  };
  roles: string[];
  capturedPathInfo?: PathInfo;
}

export interface AuthContexts {
  loggedIn: BaseContext & { user: {} };
  role: BaseContext & { user: {} };
}

export async function createContext({ userId }: { userId?: string | null }): Promise<BaseContext> {
  if (!userId) {
    return {
      roles: [],
    };
  }

  const user = await db.query.users.findFirst({
    columns: {
      id: true,
    },
    with: {
      roles: true,
    },
    where: {
      id: Number.parseInt(userId, 10),
    },
  });

  return {
    user: user ?? undefined,
    roles: user?.roles.map((role) => role.name) ?? [],
  };
}
