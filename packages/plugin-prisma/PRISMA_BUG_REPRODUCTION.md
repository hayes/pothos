# Prisma 7 Adapter Bug Reproduction

## Issue
Nested `include` queries with cursor pagination return empty results when using Prisma 7 adapters.

## Affected Adapters
- `@prisma/adapter-better-sqlite3` v7.0.0
- `@prisma/adapter-libsql` v7.0.0
- Potentially other adapters (untested)

## How to Reproduce

### Prerequisites
```bash
cd packages/plugin-prisma
pnpm install
pnpm run generate
pnpm run seed
```

### Run the Reproduction
```bash
node reproduce-prisma-bug.mjs
```

### Expected Output
```
=== Reproducing Prisma 7 Adapter Bug ===

Test 1: Top-level cursor pagination
✓ Top-level: Found 2 posts
  Post IDs: 244, 243

Test 2: Nested include without cursor
✓ Nested without cursor: Found 2 posts
  Post IDs: 500, 499

Test 3: Nested include WITH cursor
✗ Nested WITH cursor: Found 0 posts (expected: 2)
  Post IDs: none

⚠️  BUG CONFIRMED: Nested cursor pagination returns empty results
This is a Prisma 7 adapter bug, not a Pothos issue.
```

## What Works
- ✓ Top-level cursor pagination
- ✓ Nested includes without cursors
- ✓ All query patterns with Prisma 6

## What Fails
- ✗ Nested `include` queries WITH `cursor` parameter (Prisma 7 adapters only)

## Minimal Code Example

```javascript
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: 'file:./dev.db' })
});

// ✓ WORKS
await prisma.post.findMany({
  where: { authorId: 1 },
  take: 2,
  skip: 1,
  cursor: { id: 245 },
  orderBy: { createdAt: 'desc' }
});

// ✗ FAILS (returns 0 posts instead of 2)
await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    posts: {
      take: 2,
      skip: 1,
      cursor: { id: 245 },
      orderBy: { createdAt: 'desc' }
    }
  }
});
```

## Impact on Pothos
- Pothos generates correct Prisma queries
- This is a Prisma adapter runtime issue, not a Pothos type or code issue
- 94% of Pothos tests pass (81/86)
- Only nested cursor pagination tests fail

## Workaround
Use Prisma 6 until the adapter issue is fixed by Prisma team.
