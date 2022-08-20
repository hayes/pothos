// eslint-disable-next-line import/no-useless-path-segments
import { PrismaClient } from '../../prisma/client/index';

export const db = new PrismaClient();
