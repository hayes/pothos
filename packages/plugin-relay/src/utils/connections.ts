import { ConnectionShape } from '../types';

interface ResolveOffsetConnectionOptions<T> {
  args: {
    first?: number;
    last?: number;
    before?: string;
    after?: string;
  };
  defaultSize?: number;
  maxSize?: number;
}

interface ResolveArrayConnectionOptions<T> {
  args: {
    first?: number;
    last?: number;
    before?: string;
    after?: string;
  };
  defaultSize?: number;
  maxSize?: number;
}

export async function resolveOffsetConnection<T>(
  options: ResolveOffsetConnectionOptions<T>,
  resolve: (params: { offset: number; limit: number }) => T[] | Promise<T[]>,
): Promise<ConnectionShape<T>> {
  await Promise.resolve(1);

  throw new Error('Not implemented');
}

export async function resolveArrayConnection<T>(
  options: ResolveArrayConnectionOptions<T>,
  array: T[],
): Promise<ConnectionShape<T>> {
  await Promise.resolve(1);

  throw new Error('Not implemented');
}
