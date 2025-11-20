import { PrismaClient } from './tests/client/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'prisma/dev.db');
const adapter = new PrismaBetterSqlite3({
  url: `file:${dbPath}`,
});

const prisma = new PrismaClient({
  adapter,
});

async function test() {
  console.log('=== Testing Prisma 7 Cursor Pagination ===\n');
  
  // Test 1: Simple query with cursor at top level
  console.log('Test 1: Top-level cursor pagination');
  const topLevelPosts = await prisma.post.findMany({
    where: { authorId: 1 },
    take: 2,
    skip: 1,
    cursor: { id: 245 },
    orderBy: { createdAt: 'desc' },
  });
  console.log('✓ Top-level with cursor - Found:', topLevelPosts.length, 'posts');
  console.log('  IDs:', topLevelPosts.map(p => p.id));
  
  // Test 2: Nested relation without cursor
  console.log('\nTest 2: Nested relation without cursor');
  const userWithPosts = await prisma.user.findUnique({
    where: { id: 1 },
    include: {
      posts: {
        take: 2,
        orderBy: { createdAt: 'desc' },
      }
    }
  });
  console.log('✓ Nested without cursor - Found:', userWithPosts?.posts?.length || 0, 'posts');
  console.log('  IDs:', userWithPosts?.posts?.map(p => p.id) || []);
  
  // Test 3: Nested relation WITH cursor (THE FAILING CASE)
  console.log('\nTest 3: Nested relation WITH cursor');
  const userWithCursorPosts = await prisma.user.findUnique({
    where: { id: 1 },
    include: {
      posts: {
        take: 2,
        skip: 1,
        cursor: { id: 245 },
        orderBy: { createdAt: 'desc' },
      }
    }
  });
  console.log('✗ Nested WITH cursor - Found:', userWithCursorPosts?.posts?.length || 0, 'posts');
  console.log('  IDs:', userWithCursorPosts?.posts?.map(p => p.id) || []);
  
  if ((userWithCursorPosts?.posts?.length || 0) === 0) {
    console.log('\n⚠️  ISSUE REPRODUCED: Nested cursor pagination returns empty results!');
    console.log('This is a PRISMA adapter bug, not a Pothos bug.');
  }
  
  await prisma.$disconnect();
}

test().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
