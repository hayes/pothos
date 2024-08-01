import { PothosSchemaError, createContextCache } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { SmartSubscriptionOptions } from './types';

export function rootName(path: GraphQLResolveInfo['path']): string {
  if (path.prev) {
    return rootName(path.prev);
  }

  return String(path.key);
}

export function stringPath(path: GraphQLResolveInfo['path']): string {
  if (path.prev) {
    return `${stringPath(path.prev)}.${path.key}`;
  }

  return String(path.key);
}

export function subscribeOptionsFromIterator<T, Context extends object = object>(
  createIterator: (name: string, context: Context) => AsyncIterator<T>,
): Pick<SmartSubscriptionOptions<Context>, 'subscribe' | 'unsubscribe'> {
  const iterators = createContextCache(() => new Map<string, AsyncIterator<T>>());

  return {
    subscribe: async (name, context, cb) => {
      const itr = createIterator(name, context);

      const map = iterators(context)!;

      if (map.has(name)) {
        throw new PothosSchemaError(
          `Can't create multiple subscriptions for the same event name ${name}`,
        );
      }

      map.set(name, itr);

      try {
        for await (const value of { [Symbol.asyncIterator]: () => itr }) {
          cb(null, value);
        }
      } catch (error: unknown) {
        cb(error);
      }
    },
    unsubscribe: async (name, context) => {
      const map = iterators(context)!;

      if (!map?.has(name)) {
        return;
      }

      const itr = map.get(name)!;

      map.delete(name);

      if (itr.return) {
        await itr.return();
      }
    },
  };
}
