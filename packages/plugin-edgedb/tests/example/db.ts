import createClient, { Client } from 'edgedb';

let db: Client;

declare global {
  var __db__: Client | undefined;
}

if (process.env.NODE_ENV !== 'production') {
  if (!global.__db__) global.__db__ = createClient({ logging: true });
  db = global.__db__;
}

export { db };
