#!/bin/bash

echo "=== Testing Prisma 7 Adapters with Nested Cursor Pagination ==="
echo ""
echo "Creating backup of builder.ts..."
cp tests/example/builder.ts tests/example/builder.ts.bak

echo ""
echo "=== Test 1: better-sqlite3 (current) ==="
pnpm test tests/connections.test.ts -t "nested connection after" 2>&1 | grep -E "(PASS|FAIL|edges|Found)" | head -10

echo ""
echo "=== Test 2: Switching to libsql adapter ==="

# Update builder to use libsql
cat > tests/example/builder.ts << 'BUILDER'
import { join } from 'node:path';
import SchemaBuilder from '@pothos/core';
import ComplexityPlugin from '@pothos/plugin-complexity';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import SimpleObjects from '@pothos/plugin-simple-objects';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import PrismaPlugin, { type PrismaTypesFromClient } from '../../src';
import { Prisma, PrismaClient } from '../client/client.js';
import { getDatamodel } from '../generated.js';

export const queries: unknown[] = [];

const dbPath = join(process.cwd(), 'prisma/dev.db');
const libsqlClient = createClient({
  url: `file:${dbPath}`,
});
const adapter = new PrismaLibSQL(libsqlClient);

export const prisma = new PrismaClient({
  adapter,
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'stdout',
      level: 'warn',
    },
  ],
}).$extends({
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        queries.push({ action: operation, model, args });
        return query(args);
      },
    },
  },
});

type PrismaTypes = PrismaTypesFromClient<typeof prisma>;
BUILDER

echo "Running tests with libsql..."
pnpm test tests/connections.test.ts -t "nested connection after" 2>&1 | grep -E "(PASS|FAIL|edges|Found)" | head -10

echo ""
echo "Restoring original builder..."
mv tests/example/builder.ts.bak tests/example/builder.ts

echo ""
echo "=== Results ==="
echo "Check output above to compare results"
