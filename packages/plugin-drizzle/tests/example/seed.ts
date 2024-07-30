import { faker } from '@faker-js/faker';
import { db } from './db';
import { categories, comments, posts, profile, roles, userRoles, users } from './db/schema';

faker.seed(123);

const ROLES = ['admin', 'author', 'user'];
const CATEGORIES = ['news', 'sports', 'politics', 'entertainment'];

async function seed() {
  await db.delete(users).run();
  await db.delete(categories).run();
  await db.delete(roles).run();

  const categoryRows = await db
    .insert(categories)
    .values(CATEGORIES.map((name) => ({ name })))
    .returning({ id: categories.id, name: categories.name });

  const [adminRole, authorRole, userRole] = await db
    .insert(roles)
    .values(ROLES.map((name) => ({ name })))
    .returning({ id: roles.id, name: roles.name });

  const userRows = await db
    .insert(users)
    .values(
      Array.from({ length: 100 }).map((_, i) => ({
        username: faker.internet.userName(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      })),
    )
    .returning({ id: users.id });

  const admins = userRows.slice(0, 3);
  const authors = userRows.slice(0, 10);

  await db
    .insert(userRoles)
    .values([
      ...admins.map((user) => ({ userId: user.id, roleId: adminRole.id })),
      ...authors.map((user) => ({ userId: user.id, roleId: authorRole.id })),
      ...userRows.map((user) => ({ userId: user.id, roleId: userRole.id })),
    ]);

  await db.insert(profile).values(
    userRows.map((user) => ({
      userId: user.id,
      bio: faker.lorem.paragraph(),
    })),
  );

  const postRows = await db
    .insert(posts)
    .values(
      authors.flatMap((author) =>
        Array.from({ length: 15 }).map(() => ({
          authorId: author.id,
          slug: faker.lorem.slug(),
          title: faker.lorem.sentence(),
          content: faker.lorem.paragraphs(),
          published: faker.datatype.boolean({ probability: 0.8 }) ? 1 : 0,
          categoryId: categoryRows[faker.number.int({ min: 0, max: categoryRows.length - 1 })].id,
        })),
      ),
    )
    .returning({ id: posts.id, authorId: posts.authorId });

  await db.insert(comments).values(
    postRows.flatMap((post) =>
      Array.from({ length: faker.number.int({ min: 0, max: 15 }) }).map(() => ({
        postId: post.id,
        authorId: userRows[faker.number.int({ min: 0, max: userRows.length - 1 })].id,
        text: faker.lorem.paragraph(),
      })),
    ),
  );
}

// eslint-disable-next-line unicorn/prefer-top-level-await
seed().catch(console.error);
