import { faker } from '@faker-js/faker';
import { PrismaClient } from './client';

const prisma = new PrismaClient();

faker.seed(123);
