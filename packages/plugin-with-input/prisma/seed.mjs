/* eslint-disable no-magic-numbers */
import { faker } from '@faker-js/faker';
import { PrismaClient } from './client/index.js';

const prisma = new PrismaClient();

faker.seed(123);

console.log('creating users and posts');

async function main() {
  for (let i = 1; i <= 100; i += 1) {
    await prisma.user.create({
      data: {
        id: i,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      },
    });
  }

  for (let i = 1; i <= 100; i += 1) {
    await prisma.post.create({
      data: {
        id: i,
        authorId: faker.number.int({ min: 1, max: 100 }),
        title: faker.lorem.text(),
        content: faker.lorem.paragraphs(2),
      },
    });
  }

  for (let i = 1; i <= 100; i += 1) {
    await prisma.comment.create({
      data: {
        id: i,
        authorId: faker.number.int({ min: 1, max: 100 }),
        postId: faker.number.int({ min: 1, max: 100 }),
        comment: faker.lorem.text(),
      },
    });
  }
}

void main()
  .then(() => void console.log('DB seeded with test data'))
  .catch((error) => {
    console.error(error);
    throw error;
  })
  .finally(() => void prisma.$disconnect());
