import * as sqliteProxy from 'drizzle-orm/sqlite-proxy';
import { captureDrizzleQueries } from './capture';

// Keep the upstream overloads and returned client types. Only the playground module registry
// substitutes this factory; authored examples remain ordinary, copyable Drizzle code.
const drizzle = new Proxy(sqliteProxy.drizzle, {
  apply(target, receiver, args) {
    return captureDrizzleQueries(Reflect.apply(target, receiver, args));
  },
});

export const drizzleSqliteProxy = { ...sqliteProxy, drizzle };
