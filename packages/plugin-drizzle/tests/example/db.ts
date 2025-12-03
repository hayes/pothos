import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { DefaultLogger, type LogWriter } from 'drizzle-orm/logger';
import { relations } from './db/relations';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const client = createClient({ url: `file:${resolve(__dirname, './db/dev.db')}` });

export const drizzleLogs: string[] = [];

export function clearDrizzleLogs() {
  drizzleLogs.length = 0;
}

class MyLogWriter implements LogWriter {
  write(message: string) {
    if (!process.env.VITEST) {
      console.log(message);
    } else {
      drizzleLogs.push(message);
    }
  }
}

const logger = new DefaultLogger({ writer: new MyLogWriter() });
export const db = drizzle({ client, relations, logger });

export { relations };

export type DrizzleRelations = typeof relations;
