// @ts-ignore
import faker from 'faker';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

faker.seed(123);

async function main() {
  for (let i = 0; i < 100; ++i) {
    const firstName = faker.name.firstName();
    const lastName = faker.name.lastName();
    const email = faker.internet.email(firstName, lastName);

    const posts: { title: string; content: string }[] = [];

    for (let j = 0; j < 250; ++j) {
      posts.push({
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
      });
    }

    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: `${firstName} ${lastName}`,
        email,
        profile: {
          create: {
            bio: faker.name.jobDescriptor(),
          },
        },
        posts: {
          create: posts,
        },
      },
    });
  }
}

main()
  .then(() => console.log('DB seeded with test data'))
  .catch((error) => {
    throw error;
  })
  .finally(() => {
    return prisma.$disconnect();
  });
