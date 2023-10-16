import { faker } from '@faker-js/faker';
import { db } from './db';
import { comments, groups, posts, profileInfo, users, usersToGroups } from './db/schema';

faker.seed(123);

async function seed() {
  await db.delete(groups).run();
  await db.delete(usersToGroups).run();
  await db.delete(comments).run();
  await db.delete(posts).run();
  await db.delete(profileInfo).run();
  await db.delete(users).run();

  await db
    .insert(users)
    .values(
      Array.from({ length: 10 }).map((_, i) => ({
        name: faker.person.fullName(),
        invitedBy: i > 1 ? faker.number.int({ min: 1, max: i + 1 }) : null,
      })),
    )
    .run();

  const userRows = await db.select().from(users).all();

  await Promise.all(
    userRows.map((user) =>
      db
        .insert(profileInfo)
        .values(
          Array.from({ length: 10 }).map(() => ({
            metadata: faker.lorem.paragraph(),
            userId: user.id,
          })),
        )
        .run(),
    ),
  );

  await Promise.all(
    userRows.map((user) =>
      db
        .insert(posts)
        .values(
          Array.from({ length: 10 }).map(() => ({
            content: faker.lorem.paragraph(),
            authorId: user.id,
          })),
        )
        .run(),
    ),
  );

  const postRows = await db.select().from(posts).all();

  await Promise.all(
    postRows.map((post) =>
      db
        .insert(comments)
        .values(
          Array.from({ length: 10 }).map(() => ({
            text: faker.lorem.paragraph(),
            authorId: faker.number.int({ min: 1, max: 10 }),
            postId: post.id,
          })),
        )
        .run(),
    ),
  );

  await db
    .insert(groups)
    .values(Array.from({ length: 3 }).map(() => ({ name: faker.lorem.word() })))
    .run();

  const groupRows = await db.select().from(groups).all();

  await Promise.all(
    groupRows.map((group) =>
      db
        .insert(usersToGroups)
        .values(
          [
            ...new Set(Array.from({ length: 5 }).map(() => faker.number.int({ min: 1, max: 10 }))),
          ].map((userId) => ({
            groupId: group.id,
            userId,
          })),
        )
        .run(),
    ),
  );
}

// eslint-disable-next-line unicorn/prefer-top-level-await
seed().catch(console.error);
