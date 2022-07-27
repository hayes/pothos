// eslint-disable-next-line import/no-relative-packages
import { Prisma, PrismaClient } from '../prisma/client';

export const db = new PrismaClient();

console.log(Prisma.dmmf.datamodel.models);
