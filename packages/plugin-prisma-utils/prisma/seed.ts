import { PrismaPg } from '@prisma/adapter-pg';
import { faker } from '@faker-js/faker';
import pg from 'pg';
import { PrismaClient } from '../tests/client/client';

const pool = new pg.Pool({
  connectionString: 'postgresql://prisma:prisma@localhost:5455/tests',
});
const adapter = new PrismaPg(pool, { schema: 'prisma-utils' });

const prisma = new PrismaClient({ adapter });

faker.seed(123);

const now = Date.UTC(2012, 11, 12);

console.log('creating users and posts');
async function main() {
  for (let i = 0; i < 10; ++i) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName });
    const posts = [];

    for (let j = 0; j < 5; ++j) {
      posts.push({
        createdAt: new Date(now + i * 500 + j),
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        media: {
          create: [
            {
              order: 1,
              media: { create: { url: faker.internet.url() } },
            },
            {
              order: 2,
              media: { create: { url: faker.internet.url() } },
            },
          ],
        },
      });
    }

    await prisma.user.create({
      data: {
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
    take: 100,
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
    const followers = [];
    for (let i = 0; i < 3; i++) {
      followers.push(
        faker.number.int({
          min: 1,
          max: 9,
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

  for (let i = 1; i <= 3; i += 1) {
    await prisma.findUniqueRelations.create({
      data: {
        id: String(i),

        withID: {
          create: {
            id: String(i),
          },
        },

        withUnique: {
          create: {
            id: String(i),
          },
        },

        withCompositeID: {
          create: {
            a: String(i),
            b: String(i),
          },
        },

        withCompositeUnique: {
          create: {
            a: String(i),
            b: String(i),
            c: String(i),
          },
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
