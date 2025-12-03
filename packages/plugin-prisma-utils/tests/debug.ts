import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from './client/client';

const pool = new pg.Pool({
  connectionString: 'postgresql://prisma:prisma@localhost:5455/tests',
});
const adapter = new PrismaPg(pool, { schema: 'prisma-utils' });

const client = new PrismaClient({ adapter });

console.log(client);
