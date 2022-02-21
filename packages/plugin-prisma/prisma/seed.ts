// @ts-ignore
import faker from '@faker-js/faker';
import { PrismaClient } from '../tests/client';

const prisma = new PrismaClient();

faker.seed(123);

const now = Date.UTC(2012, 11, 12);

console.log('creating users and posts');
async function main() {
  for (let i = 0; i < 100; ++i) {
    const firstName = faker.name.firstName();
    const lastName = faker.name.lastName();
    const email = faker.internet.email(firstName, lastName);
    const posts: { title: string; content: string; createdAt: Date }[] = [];

    for (let j = 0; j < 250; ++j) {
      posts.push({
        createdAt: new Date(now + i * 500 + j),
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
            bio: faker.lorem.sentence(),
          },
        },
        posts: {
          create: posts,
        },
      },
    });
  }

  const users = await prisma.user.findMany({});

  const postRows = await prisma.post.findMany({
    take: 1000,
  });

  console.log('creating comments');

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        comments: {
          create: postRows.map((post, i) => ({
            postId: post.id,
            content: faker.lorem.sentence(),
            createdAt: new Date(now + user.id * postRows.length + i),
          })),
        },
      },
    });
  }

  await prisma.profile.delete({ where: { id: 2 } });

  console.log('creating followers');

  for (const user of users) {
    const followers: number[] = [];
    for (let i = 0; i < 15; i++) {
      followers.push(
        faker.datatype.number({
          min: 1,
          max: 100,
        }),
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        followers: {
          create: followers
            .filter((n, i) => followers.indexOf(n) === i)
            .map((id) => ({
              fromId: id,
            })),
        },
      },
    });
  }
}

main()
  .then(() => console.log('DB seeded with test data'))
  .catch((error) => {
    console.error(error);
    throw error;
  })
  .finally(() => {
    return prisma.$disconnect();
  });
