import { createContextCache } from '@giraphql/core';
import builder from '../builder';
import { ContextType } from '../types';

export const usersCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const sortedUsersCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const sortedUsersToKeyCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const preloadedUsersCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const preloadedUsersToKeyCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const userNodeCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const nullableUsersCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const postsCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const postCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const postsSortedCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const postSortedCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const animalCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));
export const petCounts = createContextCache(() => ({ calls: 0, loaded: 0 }));

export function countCall(context: ContextType, getCounts: typeof usersCounts, loaded: number) {
  const group = getCounts(context);
  group.calls += 1;
  group.loaded += loaded;

  return group;
}

const Count = builder
  .objectRef<{ name: string; calls: number; loaded: number }>('CallCount')
  .implement({
    fields: (t) => ({
      name: t.exposeString('name', {}),
      calls: t.exposeInt('calls', {}),
      loaded: t.exposeInt('loaded', {}),
    }),
  });

builder.queryFields((t) => ({
  counts: t.field({
    type: [Count],
    resolve: async (root, args, context) => {
      await new Promise((resolve) => {
        setTimeout(() => void resolve(null), 5);
      });

      return [
        { name: 'users', ...usersCounts(context) },
        { name: 'sortedUsers', ...sortedUsersCounts(context) },
        { name: 'sortedUsersToKey', ...sortedUsersToKeyCounts(context) },
        { name: 'preloadedUsers', ...preloadedUsersCounts(context) },
        { name: 'preloadedUsersToKey', ...preloadedUsersToKeyCounts(context) },
        { name: 'userNodes', ...userNodeCounts(context) },
        { name: 'nullableUsers', ...nullableUsersCounts(context) },
        { name: 'posts', ...postsCounts(context) },
        { name: 'post', ...postCounts(context) },
        { name: 'postsSorted', ...postsSortedCounts(context) },
        { name: 'postSorted', ...postSortedCounts(context) },
        { name: 'animals', ...animalCounts(context) },
        { name: 'pets', ...petCounts(context) },
      ].filter((count) => count.calls > 0 || count.loaded > 0);
    },
  }),
}));
