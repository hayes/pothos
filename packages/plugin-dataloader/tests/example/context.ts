import { initContextCache } from '@giraphql/core';
import { LoadableRef } from '../../src';
import { User } from './schema';
import { ContextType } from './types';

let nextID = 0;

export const createContext = (): ContextType => ({
  // eslint-disable-next-line no-plusplus
  id: nextID++,

  ...initContextCache(),

  get userLoader() {
    return User.getDataloader(this);
  },
  get getLoader() {
    return <K, V>(ref: LoadableRef<K, V, ContextType>) => ref.getDataloader(this);
  },
  get load() {
    return <K, V>(ref: LoadableRef<K, V, ContextType>, id: K) => ref.getDataloader(this).load(id);
  },
  get loadMany() {
    return <K, V>(ref: LoadableRef<K, V, ContextType>, ids: K[]) =>
      ref.getDataloader(this).loadMany(ids);
  },
});
