// Test to compare better-sqlite3 vs libsql adapters with cursor pagination

import { join } from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { PrismaClient } from './tests/client/client.js';

const dbPath = join(process.cwd(), 'prisma/dev.db');

async function testAdapter(name: string, adapter: any) {
  console.log(`\n=== Testing ${name} ===`);
  
  const prisma = new PrismaClient({ adapter });
  
  try {
    // Test nested include with cursor
    const result = await prisma.user.findUnique({
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
    
    const postCount = result?.posts?.length || 0;
    console.log(`${name}: Found ${postCount} posts`);
    console.log(`Post IDs: ${result?.posts?.map(p => p.id) || []}`);
    
    if (postCount === 0) {
      console.log(`❌ ${name} FAILS - nested cursor pagination returns empty`);
    } else {
      console.log(`✓ ${name} WORKS - nested cursor pagination returns data`);
    }
    
    await prisma.$disconnect();
    return postCount > 0;
  } catch (error) {
    console.log(`❌ ${name} ERROR:`, error.message);
    await prisma.$disconnect();
    return false;
  }
}

async function main() {
  console.log('Testing Prisma 7 adapters with nested cursor pagination\n');
  
  // Test 1: better-sqlite3
  const betterSqlite3 = new PrismaBetterSqlite3({
    url: `file:${dbPath}`,
  });
  const result1 = await testAdapter('better-sqlite3', betterSqlite3);
  
  // Test 2: libsql
  const libsqlClient = createClient({
    url: `file:${dbPath}`,
  });
  const libsqlAdapter = new PrismaLibSQL(libsqlClient);
  const result2 = await testAdapter('libsql', libsqlAdapter);
  
  console.log('\n=== Summary ===');
  console.log(`better-sqlite3: ${result1 ? '✓ WORKS' : '❌ FAILS'}`);
  console.log(`libsql: ${result2 ? '✓ WORKS' : '❌ FAILS'}`);
  
  if (!result1 && !result2) {
    console.log('\n⚠️ Both adapters fail - this is a broader Prisma 7 adapter issue');
  } else if (!result1 && result2) {
    console.log('\n⚠️ Only better-sqlite3 fails - bug is specific to better-sqlite3');
  } else if (result1 && !result2) {
    console.log('\n⚠️ Only libsql fails - bug is specific to libsql');
  } else {
    console.log('\n✓ Both adapters work - the issue may be test-specific');
  }
}

main().catch(console.error);
