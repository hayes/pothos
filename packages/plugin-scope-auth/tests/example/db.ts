import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../prisma/client/client';

const adapter = new PrismaBetterSqlite3({ url: 'file:./prisma/dev.db' });

export const db = new PrismaClient({ adapter });
