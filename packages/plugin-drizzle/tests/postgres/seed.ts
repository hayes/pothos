import { faker } from '@faker-js/faker';
import { db, queryClient } from './db';
import { comments, groups, posts, profileInfo, users, usersToGroups } from './db/schema';

faker.seed(123);

async function seed() {
  await db.delete(groups);
  await db.delete(usersToGroups);
  await db.delete(comments);
  await db.delete(posts);
  await db.delete(profileInfo);
  await db.delete(users);

  await db.insert(users).values(
    Array.from({ length: 10 }).map((_, i) => ({
      name: faker.person.fullName(),
      invitedBy: i > 1 ? faker.number.int({ min: 1, max: i + 1 }) : null,
    })),
  );

  const userRows = await db.select().from(users);

  await Promise.all(
    userRows.map((user) =>
      db.insert(profileInfo).values(
        Array.from({ length: 10 }).map(() => ({
          metadata: faker.lorem.paragraph(),
          userId: user.id,
        })),
      ),
    ),
  );

  await Promise.all(
    userRows.map((user) =>
      db.insert(posts).values(
        Array.from({ length: 10 }).map(() => ({
          content: faker.lorem.paragraph(),
          authorId: user.id,
        })),
      ),
    ),
  );

  const postRows = await db.select().from(posts);

  await Promise.all(
    postRows.map((post) =>
      db.insert(comments).values(
        Array.from({ length: 10 }).map(() => ({
          text: faker.lorem.paragraph(),
          authorId: faker.number.int({ min: 1, max: 10 }),
          postId: post.id,
        })),
      ),
    ),
  );

  await db
    .insert(groups)
    .values(Array.from({ length: 3 }).map(() => ({ name: faker.lorem.word() })));

  const groupRows = await db.select().from(groups);

  await Promise.all(
    groupRows.map((group) =>
      db.insert(usersToGroups).values(
        [
          ...new Set(Array.from({ length: 5 }).map(() => faker.number.int({ min: 1, max: 10 }))),
        ].map((userId) => ({
          groupId: group.id,
          userId,
        })),
      ),
    ),
  );

  await queryClient.end();
}

// eslint-disable-next-line unicorn/prefer-top-level-await
seed().catch(console.error);
