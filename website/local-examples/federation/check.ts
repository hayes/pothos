import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { graphql } from 'graphql';
import { schema as inventory } from './inventory/schema';
import { schema as reviews } from './reviews/schema';
import { schema as users } from './users/schema';

async function main() {
  for (const [service, schema] of Object.entries({ users, inventory, reviews })) {
    const directory = new URL(`./${service}/`, import.meta.url);
    const expected = JSON.parse(await readFile(new URL('expected.json', directory), 'utf8'));
    for (const operation of (await readdir(directory))
      .filter((file) => file.endsWith('.graphql'))
      .sort()) {
      let variableValues = {};
      try {
        variableValues = JSON.parse(
          await readFile(
            new URL(operation.replace('.graphql', '.variables.json'), directory),
            'utf8',
          ),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      const result = await graphql({
        schema,
        source: await readFile(new URL(operation, directory), 'utf8'),
        variableValues,
      });
      assert.deepEqual(
        JSON.parse(JSON.stringify(result)),
        expected[operation],
        `${service}/${operation}`,
      );
      console.log(`PASS federation ${service}/${operation}`);
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
