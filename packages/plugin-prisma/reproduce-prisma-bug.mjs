/**
 * Reproduction for Prisma 7 Adapter Bug
 * 
 * Issue: Nested include queries with cursor pagination return empty results
 * Affected: @prisma/adapter-better-sqlite3 and @prisma/adapter-libsql
 * 
 * Run with: node reproduce-prisma-bug.mjs
 */

import { join } from 'node:path';
import { PrismaClient } from './tests/client/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const dbPath = join(process.cwd(), 'prisma/dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Reproducing Prisma 7 Adapter Bug ===\n');
  
  // Test 1: Top-level cursor pagination (WORKS)
  console.log('Test 1: Top-level cursor pagination');
  const topLevel = await prisma.post.findMany({
    where: { authorId: 1 },
    take: 2,
    skip: 1,
    cursor: { id: 245 },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`✓ Top-level: Found ${topLevel.length} posts`);
  console.log(`  Post IDs: ${topLevel.map(p => p.id).join(', ')}\n`);
  
  // Test 2: Nested include without cursor (WORKS)
  console.log('Test 2: Nested include without cursor');
  const nestedNoCursor = await prisma.user.findUnique({
    where: { id: 1 },
    include: {
      posts: {
        take: 2,
        orderBy: { createdAt: 'desc' },
      }
    }
  });
  console.log(`✓ Nested without cursor: Found ${nestedNoCursor?.posts?.length || 0} posts`);
  console.log(`  Post IDs: ${nestedNoCursor?.posts?.map(p => p.id).join(', ') || 'none'}\n`);
  
  // Test 3: Nested include WITH cursor (FAILS)
  console.log('Test 3: Nested include WITH cursor');
  const nestedWithCursor = await prisma.user.findUnique({
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
  const count = nestedWithCursor?.posts?.length || 0;
  console.log(`${count === 0 ? '✗' : '✓'} Nested WITH cursor: Found ${count} posts (expected: 2)`);
  console.log(`  Post IDs: ${nestedWithCursor?.posts?.map(p => p.id).join(', ') || 'none'}\n`);
  
  // Summary
  if (count === 0) {
    console.log('⚠️  BUG CONFIRMED: Nested cursor pagination returns empty results');
    console.log('This is a Prisma 7 adapter bug, not a Pothos issue.');
  } else {
    console.log('✓ All tests passed');
  }
  
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
