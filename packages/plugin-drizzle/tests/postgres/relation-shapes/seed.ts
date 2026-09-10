import { db } from '../db';
import { comments, groups, posts, profileInfo, users, usersToGroups } from '../db/schema';

export interface RelationShapesFixture {
  userIds: number[];
  postIds: number[];
  /** The post every commenter test reads: four comments from three distinct users. */
  sharedPostId: number;
  /** The user every `where` test reads: three published posts and two drafts. */
  authorId: number;
}

/**
 * A small, deterministic fixture for the relation shapes the count has to reproduce. It replaces
 * whatever `tests/postgres/seed.ts` left behind, which nothing else reads, so the numbers the
 * assertions compare against are the ones written here rather than faker's.
 */
export async function seedRelationShapes(): Promise<RelationShapesFixture> {
  await db.delete(usersToGroups);
  await db.delete(groups);
  await db.delete(comments);
  await db.delete(posts);
  await db.delete(profileInfo);
  await db.delete(users);

  const userRows = await db
    .insert(users)
    .values([{ name: 'ada' }, { name: 'grace' }, { name: 'alan' }, { name: 'edsger' }])
    .returning({ id: users.id });
  const userIds = userRows.map((row) => row.id);
  const [author, second, third] = userIds as [number, number, number];

  const postRows = await db
    .insert(posts)
    .values([
      { content: 'published one', authorId: author },
      { content: 'published two', authorId: author },
      { content: 'published three', authorId: author },
      { content: 'draft one', authorId: author },
      { content: 'draft two', authorId: author },
      { content: 'draft three', authorId: second },
    ])
    .returning({ id: posts.id });
  const postIds = postRows.map((row) => row.id);
  const sharedPostId = postIds[0] as number;

  await db.insert(comments).values([
    // the first commenter leaves two comments on the shared post, so the junction has a
    // duplicate and the connection's rows and `relatedCount`'s distinct rows disagree
    { text: 'first', authorId: author, postId: sharedPostId },
    { text: 'again', authorId: author, postId: sharedPostId },
    { text: 'second', authorId: second, postId: sharedPostId },
    { text: 'third', authorId: third, postId: sharedPostId },
    // a comment on another post, so a count that lost the parent correlation would be caught
    { text: 'elsewhere', authorId: third, postId: postIds[1] as number },
  ]);

  return { userIds, postIds, sharedPostId, authorId: author };
}
