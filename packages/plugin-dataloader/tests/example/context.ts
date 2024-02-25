import { initContextCache } from '@pothos/core';
import { LoadableRef } from '../../src';
import { User } from './schema/objects';
import { ContextType } from './types';

let nextID = 0;

export const createContext = (): ContextType => {
  const callCounts = new Map<string, number>();
  const context: ContextType = {
    // eslint-disable-next-line no-plusplus
    id: nextID++,

    ...initContextCache(),

    get userLoader() {
      return User.getDataloader(context);
    },

    get getLoader() {
      return <K, V>(ref: LoadableRef<K, V, ContextType>) => ref.getDataloader(context);
    },
    get load() {
      return <K, V>(ref: LoadableRef<K, V, ContextType>, id: K) =>
        ref.getDataloader(context).load(id);
    },
    get loadMany() {
      return <K, V>(ref: LoadableRef<K, V, ContextType>, ids: K[]) =>
        ref.getDataloader(context).loadMany(ids);
    },
    callCounts,
    countCall: (name: string) => {
      const count = callCounts.get(name) ?? 0;
      callCounts.set(name, count + 1);
    },
  };

  return context;
};
