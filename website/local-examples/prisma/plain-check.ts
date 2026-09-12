import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import { createDatabase } from './db';
import { createPlainSchema } from './plain-schema';

async function check() {
  const { prisma, close } = await createDatabase();
  try {
    const result = await graphql({
      schema: createPlainSchema(prisma),
      source: '{ author(id: 1) { name posts { title author { name } } } }',
    });
    assert.equal(result.errors, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
      author: {
        name: 'Maya Chen',
        posts: [
          { title: 'A guide to composting', author: { name: 'Maya Chen' } },
          { title: 'Starting a seed library', author: { name: 'Maya Chen' } },
        ],
      },
    });
    console.log('PASS Prisma without a plugin: public author and published posts');
  } finally {
    await close();
  }
}
check().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
