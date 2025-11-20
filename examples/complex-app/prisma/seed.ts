import { faker } from '@faker-js/faker';
import { PrismaClient } from './client';

const prisma = new PrismaClient({ databaseUrl: 'file:./prisma/dev.db' });

faker.seed(123);
