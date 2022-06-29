import { initContextCache } from '@pothos/core';
import { LoadableRef } from '../../src';
import { User } from './schema/objects';
import { ContextType } from './types';

let nextID = 0;

export const createContext = (): ContextType => {
  const context: ContextType = {
    // eslint-disable-next-line no-plusplus
    id: nextID++,

    ...initContextCache(),

    get userLoader() {
      console.log(this);
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
  };

  return context;
};
