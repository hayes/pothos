// @ts-ignore
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { faker } from '@faker-js/faker';
import { PrismaClient } from '../tests/client/client.js';

const adapter = new PrismaBetterSqlite3(
  { url: 'file:./prisma/dev.db' },
  { timestampFormat: 'unixepoch-ms' },
);

const prisma = new PrismaClient({ adapter });

faker.seed(123);

const now = Date.UTC(2012, 11, 12);

console.log('creating users and posts');
async function main() {
  for (let i = 0; i < 100; ++i) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName });
    const posts = [];

    for (let j = 0; j < 250; ++j) {
      posts.push({
        bigIntId: BigInt(posts.length + 250 * i),
        createdAt: new Date(now + i * 500 + j),
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        published: j > 100,
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
    const followers = [];
    for (let i = 0; i < 15; i++) {
      followers.push(
        faker.number.int({
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

  console.log('creating properties and metrics');
  
  // Create 3 properties with metrics
  for (let i = 1; i <= 3; i++) {
    const property = await prisma.property.create({
      data: {
        id: `prop-${i}`,
        name: `Property ${i}`,
      },
    });

    // Create 20 metrics per property with different dates
    const metrics = [];
    const startYear = 2020;
    for (let month = 0; month < 20; month++) {
      metrics.push({
        propertyId: property.id,
        endDate: new Date(startYear, month, 1),
        month: month % 12,
        fieldA: faker.number.int({ min: 100, max: 1000 }),
        fieldB: faker.number.int({ min: 100, max: 1000 }),
        fieldC: faker.number.int({ min: 100, max: 1000 }),
      });
    }

    await prisma.metric.createMany({
      data: metrics,
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
