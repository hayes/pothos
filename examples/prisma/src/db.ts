// eslint-disable-next-line import/no-relative-packages
import { PrismaClient } from '../prisma/client';

export const db = new PrismaClient();
