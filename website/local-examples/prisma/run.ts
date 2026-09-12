import { readFile } from 'node:fs/promises';
import { graphql } from 'graphql';
import { createDatabase } from './db';
import { createSchema } from './schema';

async function main() {
  const operation = process.argv[2] ?? 'author';
  if (!/^[a-z-]+$/.test(operation)) {
    throw new Error('Choose an operation name from prisma/operations.');
  }
  const userId = Number(process.argv[3] ?? 1);
  const source = await readFile(
    new URL(`./operations/${operation}.graphql`, import.meta.url),
    'utf8',
  );
  const { prisma, statements, close } = await createDatabase();
  try {
    const result = await graphql({
      schema: createSchema(prisma),
      source,
      contextValue: { userId },
    });
    console.log(JSON.stringify(result, null, 2));
    console.log('\nSQL statements:', statements.length);
    for (const sql of statements) {
      console.log(sql);
    }
    if (result.errors) {
      process.exitCode = 1;
    }
  } finally {
    await close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
