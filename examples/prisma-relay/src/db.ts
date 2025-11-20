import { Prisma, PrismaClient } from '../prisma/client';

export const db = new PrismaClient({ databaseUrl: 'file:./prisma/dev.db' });

console.log(Prisma.dmmf.datamodel.models);
